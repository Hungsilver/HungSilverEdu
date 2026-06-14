using FluentValidation;
using HungSilver.Application.Common;
using HungSilver.Application.Evaluations;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Evaluations;

public sealed class EvaluationService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    IValidator<UpsertEvaluationRequest> validator) : IEvaluationService
{
    public async Task<Result<List<MonthlyEvaluationDto>>> GetByClassMonthAsync(Guid classId, int year, int month, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<List<MonthlyEvaluationDto>>(access.Error);

        var studentIds = await context.Enrollments.AsNoTracking()
            .Where(e => e.ClassId == classId && e.IsActive)
            .Select(e => e.StudentId).ToListAsync(ct);

        var evals = await context.MonthlyEvaluations.AsNoTracking()
            .Where(m => studentIds.Contains(m.StudentId) && m.Year == year && m.Month == month)
            .ToListAsync(ct);

        return await ToDtosAsync(evals, ct);
    }

    public async Task<Result<List<MonthlyEvaluationDto>>> GetByStudentAsync(Guid studentId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return Result.Failure<List<MonthlyEvaluationDto>>(access.Error);

        var evals = await context.MonthlyEvaluations.AsNoTracking()
            .Where(m => m.StudentId == studentId)
            .OrderByDescending(m => m.Year).ThenByDescending(m => m.Month)
            .ToListAsync(ct);

        return await ToDtosAsync(evals, ct);
    }

    public async Task<Result<MonthlyEvaluationDto>> UpsertAsync(UpsertEvaluationRequest request, CancellationToken ct = default)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MonthlyEvaluationDto>(validation.ToError("Evaluation.Validation"));

        var access = request.ClassId is not null
            ? await accessGuard.EnsureCanAccessClassAsync(request.ClassId.Value, ct)
            : await accessGuard.EnsureCanAccessStudentAsync(request.StudentId, ct);
        if (access.IsFailure)
            return Result.Failure<MonthlyEvaluationDto>(access.Error);

        var eval = await context.MonthlyEvaluations
            .FirstOrDefaultAsync(m => m.StudentId == request.StudentId && m.Year == request.Year && m.Month == request.Month, ct);

        if (eval is null)
        {
            eval = new MonthlyEvaluation { StudentId = request.StudentId, Year = request.Year, Month = request.Month };
            context.MonthlyEvaluations.Add(eval);
        }

        eval.ClassId = request.ClassId;
        eval.AttendanceScore = request.AttendanceScore;
        eval.HomeworkScore = request.HomeworkScore;
        eval.AttitudeScore = request.AttitudeScore;
        eval.VocabularyScore = request.VocabularyScore;
        eval.GrammarScore = request.GrammarScore;
        eval.Comment = request.Comment?.Trim();
        eval.Rank = ComputeRank(Total(eval));

        await context.SaveChangesAsync(ct);
        return (await ToDtosAsync([eval], ct))[0];
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var eval = await context.MonthlyEvaluations.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (eval is null)
            return Result.Failure(Error.NotFound("Evaluation.NotFound", "Không tìm thấy đánh giá."));

        var access = await accessGuard.EnsureCanAccessStudentAsync(eval.StudentId, ct);
        if (access.IsFailure)
            return access;

        context.MonthlyEvaluations.Remove(eval);
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<LeaderboardDto>> GetLeaderboardAsync(Guid? classId, CancellationToken ct = default)
    {
        if (classId is not null)
        {
            var access = await accessGuard.EnsureCanAccessClassAsync(classId.Value, ct);
            if (access.IsFailure)
                return Result.Failure<LeaderboardDto>(access.Error);
        }

        var classIds = await ScopeClassIdsAsync(classId, ct);
        var studentIds = await context.Enrollments.AsNoTracking()
            .Where(e => classIds.Contains(e.ClassId) && e.IsActive)
            .Select(e => e.StudentId).Distinct().ToListAsync(ct);

        if (studentIds.Count == 0)
            return new LeaderboardDto([], [], []);

        var weekAgo = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7).AddDays(-7));

        var names = await context.Students.AsNoTracking()
            .Where(s => studentIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName, ct);
        string Name(Guid id) => names.GetValueOrDefault(id, string.Empty);

        // Điểm thưởng trong tuần (reward - penalty)
        var points = await context.PointEntries.AsNoTracking()
            .Where(p => studentIds.Contains(p.StudentId) && DateOnly.FromDateTime(p.CreatedAtUtc) >= weekAgo)
            .ToListAsync(ct);
        var topReward = points.GroupBy(p => p.StudentId)
            .Select(g => new LeaderEntry(g.Key, Name(g.Key),
                g.Where(x => x.Type == PointType.Reward).Sum(x => x.Points) - g.Where(x => x.Type == PointType.Penalty).Sum(x => x.Points)))
            .Where(e => e.Value > 0).OrderByDescending(e => e.Value).Take(10).ToList();

        // Bản ghi buổi học trong tuần
        var recs = await (
            from r in context.StudentSessionRecords.AsNoTracking()
            join s in context.ClassSessions.AsNoTracking() on r.ClassSessionId equals s.Id
            where studentIds.Contains(r.StudentId) && s.SessionDate >= weekAgo
            select new { r.StudentId, r.Attendance, r.Homework })
            .ToListAsync(ct);

        var topAttendance = recs.GroupBy(r => r.StudentId)
            .Select(g => new LeaderEntry(g.Key, Name(g.Key),
                Math.Round((decimal)g.Count(x => x.Attendance is AttendanceStatus.Present or AttendanceStatus.Late) / g.Count() * 100, 0)))
            .OrderByDescending(e => e.Value).Take(10).ToList();

        var topHomework = recs.GroupBy(r => r.StudentId)
            .Select(g => new LeaderEntry(g.Key, Name(g.Key),
                Math.Round((decimal)g.Count(x => x.Homework is HomeworkStatus.CompletedWell or HomeworkStatus.Completed) / g.Count() * 100, 0)))
            .OrderByDescending(e => e.Value).Take(10).ToList();

        return new LeaderboardDto(topReward, topAttendance, topHomework);
    }

    private async Task<List<Guid>> ScopeClassIdsAsync(Guid? classId, CancellationToken ct)
    {
        if (classId is not null)
            return [classId.Value];
        var q = context.Classes.AsNoTracking().AsQueryable();
        if (!accessGuard.IsAdmin)
            q = q.Where(c => c.TeacherId == accessGuard.TeacherScopeId);
        return await q.Select(c => c.Id).ToListAsync(ct);
    }

    private async Task<List<MonthlyEvaluationDto>> ToDtosAsync(List<MonthlyEvaluation> evals, CancellationToken ct)
    {
        if (evals.Count == 0)
            return [];
        var ids = evals.Select(e => e.StudentId).Distinct().ToList();
        var names = await context.Students.AsNoTracking()
            .Where(s => ids.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName, ct);

        return evals.Select(e => new MonthlyEvaluationDto(
            e.Id, e.StudentId, names.GetValueOrDefault(e.StudentId, string.Empty), e.ClassId, e.Year, e.Month,
            e.AttendanceScore, e.HomeworkScore, e.AttitudeScore, e.VocabularyScore, e.GrammarScore,
            Total(e), e.Rank, e.Comment)).ToList();
    }

    private static decimal Total(MonthlyEvaluation e) =>
        e.AttendanceScore + e.HomeworkScore + e.AttitudeScore + e.VocabularyScore + e.GrammarScore;

    private static EvaluationRank ComputeRank(decimal total) =>
        total >= 45 ? EvaluationRank.Excellent
        : total >= 35 ? EvaluationRank.Good
        : total >= 25 ? EvaluationRank.Satisfactory
        : EvaluationRank.NeedsImprovement;
}
