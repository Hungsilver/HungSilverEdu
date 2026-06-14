using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Sessions;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Sessions;

public sealed class SessionService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    ICurrentUser currentUser) : ISessionService
{
    private static readonly Error SessionNotFound = Error.NotFound("Session.NotFound", "Không tìm thấy buổi học.");

    public async Task<Result<SessionSheetDto>> GetSessionSheetAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await context.ClassSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null)
            return Result.Failure<SessionSheetDto>(SessionNotFound);

        var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<SessionSheetDto>(access.Error);

        var cls = await context.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == session.ClassId, ct);

        // Roster đang học của lớp.
        var roster = await (
            from e in context.Enrollments
            join s in context.Students on e.StudentId equals s.Id
            where e.ClassId == session.ClassId && e.IsActive
            orderby s.FullName
            select new { s.Id, s.FullName })
            .ToListAsync(ct);

        var studentIds = roster.Select(r => r.Id).ToList();

        var records = await context.StudentSessionRecords
            .Where(r => r.ClassSessionId == sessionId && studentIds.Contains(r.StudentId))
            .ToListAsync(ct);
        var recordMap = records.ToDictionary(r => r.StudentId);

        var sessionPoints = await context.PointEntries
            .Where(p => p.ClassSessionId == sessionId && studentIds.Contains(p.StudentId))
            .OrderBy(p => p.CreatedAtUtc)
            .ToListAsync(ct);
        var pointsByStudent = sessionPoints.GroupBy(p => p.StudentId).ToDictionary(g => g.Key, g => g.ToList());

        var balances = await ComputeBalancesAsync(studentIds, ct);

        var rows = roster.Select(r =>
        {
            recordMap.TryGetValue(r.Id, out var rec);
            var pts = pointsByStudent.TryGetValue(r.Id, out var list) ? list : [];
            return new SessionStudentRowDto(
                r.Id, r.FullName,
                rec?.Attendance ?? AttendanceStatus.Present,
                rec?.Homework ?? HomeworkStatus.NotAssigned,
                rec?.Attitude ?? AttitudeStatus.Normal,
                rec?.PersonalNote,
                balances.GetValueOrDefault(r.Id),
                pts.Select(p => new PointEntryDto(p.Id, p.StudentId, p.Type, p.Points, p.Reason, p.CreatedAtUtc)).ToList());
        }).ToList();

        return new SessionSheetDto(
            session.Id, session.ClassId, cls?.Name ?? string.Empty, session.SessionNumber, session.SessionDate,
            session.StartTime, session.EndTime, session.Topic, session.Status, rows);
    }

    public async Task<Result> SaveAttendanceAsync(Guid sessionId, SaveAttendanceRequest request, CancellationToken ct = default)
    {
        var session = await context.ClassSessions.FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null)
            return Result.Failure(SessionNotFound);

        var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
        if (access.IsFailure)
            return access;

        var studentIds = request.Entries.Select(e => e.StudentId).ToList();
        var existing = await context.StudentSessionRecords
            .Where(r => r.ClassSessionId == sessionId && studentIds.Contains(r.StudentId))
            .ToListAsync(ct);
        var existingMap = existing.ToDictionary(r => r.StudentId);

        foreach (var entry in request.Entries)
        {
            if (existingMap.TryGetValue(entry.StudentId, out var rec))
            {
                rec.Attendance = entry.Attendance;
                rec.Homework = entry.Homework;
                rec.Attitude = entry.Attitude;
                rec.PersonalNote = entry.PersonalNote?.Trim();
            }
            else
            {
                context.StudentSessionRecords.Add(new StudentSessionRecord
                {
                    ClassSessionId = sessionId,
                    StudentId = entry.StudentId,
                    Attendance = entry.Attendance,
                    Homework = entry.Homework,
                    Attitude = entry.Attitude,
                    PersonalNote = entry.PersonalNote?.Trim()
                });
            }
        }

        if (session.Status == SessionStatus.Scheduled)
            session.Status = SessionStatus.Completed;

        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<PointEntryDto>> AddPointAsync(Guid sessionId, AddPointRequest request, CancellationToken ct = default)
    {
        if (request.Points <= 0)
            return Result.Failure<PointEntryDto>(Error.Validation("Point.Invalid", "Điểm phải lớn hơn 0."));
        if (string.IsNullOrWhiteSpace(request.Reason))
            return Result.Failure<PointEntryDto>(Error.Validation("Point.ReasonRequired", "Cần nhập lý do."));

        var session = await context.ClassSessions.FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null)
            return Result.Failure<PointEntryDto>(SessionNotFound);

        var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<PointEntryDto>(access.Error);

        var entry = new PointEntry
        {
            StudentId = request.StudentId,
            ClassSessionId = sessionId,
            Type = request.Type,
            Points = request.Points,
            Reason = request.Reason.Trim(),
            AwardedByUserId = currentUser.UserId
        };
        context.PointEntries.Add(entry);
        await context.SaveChangesAsync(ct);

        return new PointEntryDto(entry.Id, entry.StudentId, entry.Type, entry.Points, entry.Reason, entry.CreatedAtUtc);
    }

    public async Task<Result> RemovePointAsync(Guid entryId, CancellationToken ct = default)
    {
        var entry = await context.PointEntries.FirstOrDefaultAsync(p => p.Id == entryId, ct);
        if (entry is null)
            return Result.Failure(Error.NotFound("Point.NotFound", "Không tìm thấy điểm."));

        if (entry.ClassSessionId is not null)
        {
            var session = await context.ClassSessions.FirstOrDefaultAsync(s => s.Id == entry.ClassSessionId, ct);
            if (session is not null)
            {
                var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
                if (access.IsFailure)
                    return access;
            }
        }
        else if (!accessGuard.IsAdmin)
        {
            return Result.Failure(Error.Forbidden("Point.Forbidden", "Bạn không có quyền xóa điểm này."));
        }

        context.PointEntries.Remove(entry); // soft delete
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<StudentProgressDto>> GetStudentProgressAsync(Guid studentId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return Result.Failure<StudentProgressDto>(access.Error);

        var student = await context.Students.AsNoTracking().FirstOrDefaultAsync(s => s.Id == studentId, ct);
        if (student is null)
            return Result.Failure<StudentProgressDto>(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));

        var records = await context.StudentSessionRecords.AsNoTracking()
            .Where(r => r.StudentId == studentId)
            .ToListAsync(ct);

        var total = records.Count;
        var attended = records.Count(r => r.Attendance is AttendanceStatus.Present or AttendanceStatus.Late);
        var absent = records.Count(r => r.Attendance is AttendanceStatus.ExcusedAbsence or AttendanceStatus.UnexcusedAbsence);
        var hwCompleted = records.Count(r => r.Homework is HomeworkStatus.CompletedWell or HomeworkStatus.Completed);
        var hwNotCompleted = records.Count(r => r.Homework == HomeworkStatus.NotCompleted);

        var points = await context.PointEntries.AsNoTracking()
            .Where(p => p.StudentId == studentId)
            .ToListAsync(ct);
        var rewardPoints = points.Where(p => p.Type == PointType.Reward).Sum(p => p.Points);
        var penaltyPoints = points.Where(p => p.Type == PointType.Penalty).Sum(p => p.Points);
        var redeemed = await context.RewardRedemptions.AsNoTracking()
            .Where(r => r.StudentId == studentId)
            .SumAsync(r => (int?)r.PointsSpent, ct) ?? 0;
        var balance = rewardPoints - penaltyPoints - redeemed;

        var assessments = await context.StudentAssessments.AsNoTracking()
            .Where(a => a.StudentId == studentId)
            .OrderBy(a => a.TakenOn)
            .ToListAsync(ct);

        var latest = assessments.LastOrDefault();
        SkillScoresDto? latestSkills = latest is null
            ? null
            : new SkillScoresDto(latest.OverallScore, latest.Vocabulary, latest.Grammar,
                latest.Listening, latest.Speaking, latest.Reading, latest.Writing);

        var trend = assessments.Select(a => new AssessmentPointDto(
            a.TakenOn, a.OverallScore, a.Vocabulary, a.Grammar, a.Listening, a.Speaking, a.Reading, a.Writing)).ToList();

        return new StudentProgressDto(
            student.Id, student.FullName, total, attended, absent,
            hwCompleted, hwNotCompleted, rewardPoints, penaltyPoints, balance,
            latestSkills, trend);
    }

    public async Task<Result> RedeemRewardAsync(Guid studentId, RedeemRewardRequest request, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(studentId, ct);
        if (access.IsFailure)
            return access;

        var balance = (await ComputeBalancesAsync([studentId], ct)).GetValueOrDefault(studentId);
        var cost = (int)request.Tier;

        if (balance < cost)
            return Result.Failure(Error.Conflict("Reward.Insufficient",
                $"Số dư điểm thưởng ({balance}) không đủ để quy đổi mốc {cost} điểm."));

        context.RewardRedemptions.Add(new RewardRedemption
        {
            StudentId = studentId,
            Tier = request.Tier,
            PointsSpent = cost,
            RedeemedOn = DateOnly.FromDateTime(DateTime.UtcNow),
            Note = request.Note?.Trim()
        });

        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    /// <summary>Số dư điểm thưởng mỗi học sinh = SUM(reward) − SUM(penalty) − SUM(đã quy đổi).</summary>
    private async Task<Dictionary<Guid, int>> ComputeBalancesAsync(List<Guid> studentIds, CancellationToken ct)
    {
        if (studentIds.Count == 0)
            return [];

        var pointAgg = await context.PointEntries
            .Where(p => studentIds.Contains(p.StudentId))
            .GroupBy(p => p.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                Reward = g.Where(x => x.Type == PointType.Reward).Sum(x => x.Points),
                Penalty = g.Where(x => x.Type == PointType.Penalty).Sum(x => x.Points)
            })
            .ToListAsync(ct);

        var redeemed = await context.RewardRedemptions
            .Where(r => studentIds.Contains(r.StudentId))
            .GroupBy(r => r.StudentId)
            .Select(g => new { StudentId = g.Key, Spent = g.Sum(x => x.PointsSpent) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Spent, ct);

        var result = new Dictionary<Guid, int>();
        foreach (var id in studentIds)
        {
            var agg = pointAgg.FirstOrDefault(x => x.StudentId == id);
            var spent = redeemed.GetValueOrDefault(id);
            result[id] = (agg?.Reward ?? 0) - (agg?.Penalty ?? 0) - spent;
        }
        return result;
    }
}
