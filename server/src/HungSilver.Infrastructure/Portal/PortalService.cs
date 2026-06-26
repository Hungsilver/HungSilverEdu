using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Portal;
using HungSilver.Application.Schedule;
using HungSilver.Application.Settings;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Portal;

public sealed class PortalService(
    AppDbContext context,
    ICurrentRelationCleanupService relationCleanup,
    ICurrentUser currentUser,
    ISettingsResolver settings) : IPortalService
{
    public async Task<Result<PortalProfileDto>> GetMyProfileAsync(CancellationToken ct = default)
    {
        var userId = currentUser.UserId;
        if (userId is null)
            return Result.Failure<PortalProfileDto>(Error.Unauthorized("Portal.Unauthorized", "Chưa đăng nhập."));

        var student = await context.Students.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (student is null)
            return Result.Failure<PortalProfileDto>(Error.NotFound("Portal.NotLinked", "Tài khoản chưa được liên kết với hồ sơ học sinh."));

        var records = await context.StudentSessionRecords.AsNoTracking()
            .Where(r => r.StudentId == student.Id)
            .Select(r => new { r.Attendance, r.Homework })
            .ToListAsync(ct);
        var total = records.Count;
        var attended = records.Count(r => r.Attendance is AttendanceStatus.Present or AttendanceStatus.Late);
        var hwDone = records.Count(r => r.Homework is HomeworkStatus.CompletedWell or HomeworkStatus.Completed);

        var reward = await context.PointEntries.AsNoTracking().Where(p => p.StudentId == student.Id && p.Type == PointType.Reward).SumAsync(p => (int?)p.Points, ct) ?? 0;
        var penalty = await context.PointEntries.AsNoTracking().Where(p => p.StudentId == student.Id && p.Type == PointType.Penalty).SumAsync(p => (int?)p.Points, ct) ?? 0;
        var redeemed = await context.RewardRedemptions.AsNoTracking().Where(r => r.StudentId == student.Id).SumAsync(r => (int?)r.PointsSpent, ct) ?? 0;
        var balance = reward - penalty - redeemed;

        var classIds = await LoadStudentClassIdsAsync(student.Id, ct);

        var today = DateOnly.FromDateTime(DateTime.Now);
        var upcoming = await (
            from s in context.ClassSessions.AsNoTracking()
            join c in context.Classes.AsNoTracking() on s.ClassId equals c.Id
            where classIds.Contains(s.ClassId) && s.Status != SessionStatus.Cancelled && s.SessionDate >= today
            orderby s.SessionDate, s.StartTime
            select new PortalSessionDto(s.Id, c.Name, s.SessionDate, s.StartTime, s.Topic))
            .Take(10)
            .ToListAsync(ct);

        return new PortalProfileDto(student.Id, student.FullName, student.EnglishLevel, student.LearningGoal,
            total, attended, hwDone, balance, upcoming);
    }

    public async Task<Result<List<PortalAssignmentDto>>> GetMyAssignmentsAsync(CancellationToken ct = default)
    {
        var studentResult = await GetLinkedStudentAsync(ct);
        if (studentResult.IsFailure)
            return Result.Failure<List<PortalAssignmentDto>>(studentResult.Error);
        var student = studentResult.Value;

        var classIds = await LoadStudentClassIdsAsync(student.Id, ct);
        if (classIds.Count == 0)
            return new List<PortalAssignmentDto>();

        var assignments = await (
            from a in context.Assignments.AsNoTracking()
            join c in context.Classes.AsNoTracking() on a.ClassId equals c.Id
            where classIds.Contains(a.ClassId)
            orderby a.DueDate descending, a.CreatedAt descending
            select new { a, c.Name }).ToListAsync(ct);
        if (assignments.Count == 0)
            return new List<PortalAssignmentDto>();

        var assignmentIds = assignments.Select(x => x.a.Id).ToList();
        var subList = await context.Submissions.AsNoTracking()
            .Where(s => s.StudentId == student.Id && assignmentIds.Contains(s.AssignmentId))
            .ToListAsync(ct);
        var subs = subList.GroupBy(s => s.AssignmentId).ToDictionary(g => g.Key, g => g.First());

        var materialIds = assignments.Where(x => x.a.MaterialId.HasValue).Select(x => x.a.MaterialId!.Value).Distinct().ToList();
        var materials = materialIds.Count == 0
            ? new Dictionary<Guid, LearningMaterial>()
            : await context.LearningMaterials.AsNoTracking()
                .Where(m => materialIds.Contains(m.Id))
                .ToDictionaryAsync(m => m.Id, m => m, ct);

        var today = DateOnly.FromDateTime(DateTime.Now);
        return assignments.Select(x =>
        {
            subs.TryGetValue(x.a.Id, out var sub);
            var status = sub is not null && sub.Status != SubmissionStatus.NotSubmitted
                ? sub.Status
                : (x.a.DueDate is not null && today > x.a.DueDate ? SubmissionStatus.Late : SubmissionStatus.NotSubmitted);

            string? matTitle = null, matUrl = null;
            if (x.a.MaterialId.HasValue && materials.TryGetValue(x.a.MaterialId.Value, out var m))
            {
                matTitle = m.Title;
                matUrl = m.Source == MaterialSource.ServerFile && m.StoredFileId is not null ? $"/api/files/{m.StoredFileId}" : m.Url;
            }

            return new PortalAssignmentDto(x.a.Id, x.Name, x.a.Title, x.a.Instructions, matTitle, matUrl,
                x.a.DueDate, status, sub?.SubmittedOn, sub?.Link);
        }).ToList();
    }

    public async Task<Result<List<CalendarSessionDto>>> GetScheduleRangeAsync(DateOnly fromDate, DateOnly toDate, CancellationToken ct = default)
    {
        var studentResult = await GetLinkedStudentAsync(ct);
        if (studentResult.IsFailure)
            return Result.Failure<List<CalendarSessionDto>>(studentResult.Error);
        var student = studentResult.Value;

        var classIds = await LoadStudentClassIdsAsync(student.Id, ct);
        if (classIds.Count == 0)
            return new List<CalendarSessionDto>();

        var rows = await (
            from s in context.ClassSessions.AsNoTracking()
            join c in context.Classes.AsNoTracking() on s.ClassId equals c.Id
            where classIds.Contains(s.ClassId) && s.SessionDate >= fromDate && s.SessionDate <= toDate
            orderby s.SessionDate, s.StartTime
            select new
            {
                s.Id, s.ClassId, c.Name, s.SessionNumber, s.SessionDate, s.StartTime, s.EndTime, s.Topic, s.Status,
                c.TeacherProfileId, c.TeacherName, c.BranchId, c.BranchName, c.BranchCode, c.SubjectName, c.GradeName
            }).ToListAsync(ct);

        var shiftJson = await settings.GetEffectiveValueAsync(SettingKeys.ScheduleShifts, ct: ct);
        var shifts = ShiftResolver.Parse(shiftJson);

        return rows
            .Select(r =>
            {
                var (shiftName, shiftOrder) = shifts.Resolve(r.BranchId, r.StartTime);
                return new CalendarSessionDto(
                    r.Id, r.ClassId, r.Name, r.SessionNumber, r.SessionDate,
                    r.StartTime, r.EndTime, r.Topic, r.Status,
                    r.TeacherProfileId, r.TeacherName, r.BranchId, r.BranchName, r.BranchCode,
                    r.SubjectName, r.GradeName, shiftName, shiftOrder);
            })
            .OrderBy(i => i.SessionDate).ThenBy(i => i.ShiftOrder).ThenBy(i => i.StartTime)
            .ToList();
    }

    public async Task<Result> SubmitAssignmentAsync(Guid assignmentId, SubmitAssignmentRequest request, CancellationToken ct = default)
    {
        var studentResult = await GetLinkedStudentAsync(ct);
        if (studentResult.IsFailure)
            return Result.Failure(studentResult.Error);
        var student = studentResult.Value;

        var assignment = await context.Assignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment is null)
            return Result.Failure(Error.NotFound("Assignment.NotFound", "Không tìm thấy bài tập."));

        var enrolled = (await relationCleanup.LoadValidActiveStudentIdsByClassesAsync([assignment.ClassId], ct))
            .Contains(student.Id);
        if (!enrolled)
            return Result.Failure(Error.Forbidden("Assignment.NotInClass", "Bài tập không thuộc lớp của bạn."));

        var today = DateOnly.FromDateTime(DateTime.Now);
        var sub = await context.Submissions.FirstOrDefaultAsync(s => s.AssignmentId == assignmentId && s.StudentId == student.Id, ct);
        var isNew = sub is null;
        if (sub is null)
        {
            sub = new Submission { AssignmentId = assignmentId, StudentId = student.Id };
            context.Submissions.Add(sub);
        }

        void Apply(Submission s)
        {
            s.Status = assignment.DueDate is not null && today > assignment.DueDate ? SubmissionStatus.Late : SubmissionStatus.Submitted;
            s.SubmittedOn = today;
            s.Link = request.Link?.Trim();
            s.Note = request.Note?.Trim();
        }

        Apply(sub);

        try
        {
            await context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (isNew)
        {
            // Đua check-then-insert: bản ghi nộp đã tồn tại (vi phạm unique (AssignmentId, StudentId))
            // → tách bản mới, nạp lại bản hiện có rồi ghi đè nội dung nộp mới nhất.
            context.Entry(sub).State = EntityState.Detached;
            var existing = await context.Submissions.FirstOrDefaultAsync(s => s.AssignmentId == assignmentId && s.StudentId == student.Id, ct);
            if (existing is null)
                throw;
            Apply(existing);
            await context.SaveChangesAsync(ct);
        }
        return Result.Success();
    }

    private async Task<Result<Student>> GetLinkedStudentAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (userId is null)
            return Result.Failure<Student>(Error.Unauthorized("Portal.Unauthorized", "Chưa đăng nhập."));

        var student = await context.Students.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (student is null)
            return Result.Failure<Student>(Error.NotFound("Portal.NotLinked", "Tài khoản chưa được liên kết với hồ sơ học sinh."));

        return student;
    }

    private async Task<List<Guid>> LoadStudentClassIdsAsync(Guid studentId, CancellationToken ct)
    {
        var rows = await (
            from e in context.Enrollments.AsNoTracking()
            join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
            join c in context.Classes.AsNoTracking() on e.ClassId equals c.Id
            where e.StudentId == studentId && e.IsActive
            select e.ClassId)
            .Distinct()
            .ToListAsync(ct);

        return rows;
    }
}
