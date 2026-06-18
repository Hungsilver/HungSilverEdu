using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Classes;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Classes;

public sealed class ClassService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    IUserDirectory userDirectory,
    IValidator<CreateClassRequest> createValidator,
    IValidator<UpdateClassRequest> updateValidator) : IClassService
{
    private static readonly Error NotFoundError = Error.NotFound("Class.NotFound", "Không tìm thấy lớp học.");

    public async Task<Result<PagedResult<ClassListItemDto>>> GetPagedAsync(PagedRequest request, bool includeDeleted = false, CancellationToken ct = default)
    {
        var query = includeDeleted && accessGuard.IsAdmin
            ? context.Classes.IgnoreQueryFilters().AsNoTracking()
            : context.Classes.AsNoTracking();

        if (!accessGuard.IsAdmin)
            query = query.Where(c => c.TeacherId == accessGuard.TeacherScopeId);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(term));
        }

        var total = await query.CountAsync(ct);
        var page = Math.Max(request.Page, 1);

        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        var classIds = items.Select(c => c.Id).ToList();
        var sizes = await context.Enrollments
            .Where(e => classIds.Contains(e.ClassId) && e.IsActive)
            .GroupBy(e => e.ClassId)
            .Select(g => new { ClassId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ClassId, x => x.Count, ct);

        var teacherNames = await userDirectory.GetDisplayNamesAsync(items.Select(c => c.TeacherId), ct);

        var dtos = items.Select(c => new ClassListItemDto(
            c.Id, c.Name, c.TeacherId,
            teacherNames.GetValueOrDefault(c.TeacherId),
            c.MaxCapacity,
            sizes.GetValueOrDefault(c.Id),
            c.IsActive, c.IsDeleted, c.CreatedAt)).ToList();

        return new PagedResult<ClassListItemDto>
        {
            Items = dtos,
            Page = page,
            PageSize = request.PageSize,
            TotalCount = total
        };
    }

    public async Task<Result<ClassDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(id, ct);
        if (access.IsFailure)
            return Result.Failure<ClassDto>(access.Error);

        var cls = await context.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cls is null)
            return Result.Failure<ClassDto>(NotFoundError);

        return await BuildClassDtoAsync(cls, ct);
    }

    public async Task<Result<ClassDto>> CreateAsync(CreateClassRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<ClassDto>(validation.ToError("Class.Validation"));

        var teacherCheck = await ValidateTeacherAsync(request.TeacherId, ct);
        if (teacherCheck.IsFailure)
            return Result.Failure<ClassDto>(teacherCheck.Error);

        var cls = new ClassRoom
        {
            Name = request.Name.Trim(),
            TeacherId = request.TeacherId,
            CurriculumId = request.CurriculumId,
            MaxCapacity = request.MaxCapacity,
            Schedule = request.Schedule?.Trim(),
            StartDate = request.StartDate,
            IsActive = request.IsActive
        };

        context.Classes.Add(cls);
        await context.SaveChangesAsync(ct);

        return await BuildClassDtoAsync(cls, ct);
    }

    public async Task<Result<ClassDto>> UpdateAsync(Guid id, UpdateClassRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<ClassDto>(validation.ToError("Class.Validation"));

        var cls = await context.Classes.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cls is null)
            return Result.Failure<ClassDto>(NotFoundError);

        var teacherCheck = await ValidateTeacherAsync(request.TeacherId, ct);
        if (teacherCheck.IsFailure)
            return Result.Failure<ClassDto>(teacherCheck.Error);

        cls.Name = request.Name.Trim();
        cls.TeacherId = request.TeacherId;
        cls.CurriculumId = request.CurriculumId;
        cls.MaxCapacity = request.MaxCapacity;
        cls.Schedule = request.Schedule?.Trim();
        cls.StartDate = request.StartDate;
        cls.IsActive = request.IsActive;

        await context.SaveChangesAsync(ct);
        return await BuildClassDtoAsync(cls, ct);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var cls = await context.Classes.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (cls is null)
            return Result.Failure(NotFoundError);

        // Không FK → tự kiểm ràng buộc: chặn xóa lớp còn học sinh đang học.
        var hasStudents = await context.Enrollments.AnyAsync(e => e.ClassId == id && e.IsActive, ct);
        if (hasStudents)
            return Result.Failure(Error.Conflict("Class.HasStudents", "Không thể xóa lớp khi vẫn còn học sinh đang học."));

        context.Classes.Remove(cls); // interceptor → soft delete
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var cls = await context.Classes.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == id && c.IsDeleted, ct);
        if (cls is null)
            return Result.Failure(NotFoundError);

        cls.IsDeleted = false;
        cls.DeletedAt = null;
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> AssignTeacherAsync(Guid classId, AssignTeacherRequest request, CancellationToken ct = default)
    {
        var cls = await context.Classes.FirstOrDefaultAsync(c => c.Id == classId, ct);
        if (cls is null)
            return Result.Failure(NotFoundError);

        var teacherCheck = await ValidateTeacherAsync(request.TeacherId, ct);
        if (teacherCheck.IsFailure)
            return teacherCheck;

        cls.TeacherId = request.TeacherId;
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<List<RosterItemDto>>> GetRosterAsync(Guid classId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<List<RosterItemDto>>(access.Error);

        var roster = await (
            from e in context.Enrollments
            join s in context.Students on e.StudentId equals s.Id
            where e.ClassId == classId && e.IsActive
            orderby s.FullName
            select new RosterItemDto(e.Id, s.Id, s.FullName, s.Phone, s.ParentPhone, e.EnrolledOn, s.UserId))
            .ToListAsync(ct);

        return roster;
    }

    public async Task<Result<List<ClassStudentOverviewDto>>> GetOverviewAsync(Guid classId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return Result.Failure<List<ClassStudentOverviewDto>>(access.Error);

        var roster = await (
            from e in context.Enrollments
            join s in context.Students on e.StudentId equals s.Id
            where e.ClassId == classId && e.IsActive
            orderby s.FullName
            select new { s.Id, s.FullName })
            .ToListAsync(ct);

        if (roster.Count == 0)
            return new List<ClassStudentOverviewDto>();

        var studentIds = roster.Select(r => r.Id).ToList();

        // Số dư điểm = thưởng − phạt − đã quy đổi (đồng bộ công thức DashboardService).
        var pointAgg = await context.PointEntries.AsNoTracking()
            .Where(p => studentIds.Contains(p.StudentId))
            .GroupBy(p => p.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                Reward = g.Where(x => x.Type == PointType.Reward).Sum(x => x.Points),
                Penalty = g.Where(x => x.Type == PointType.Penalty).Sum(x => x.Points)
            })
            .ToListAsync(ct);

        var redeemed = await context.RewardRedemptions.AsNoTracking()
            .Where(r => studentIds.Contains(r.StudentId))
            .GroupBy(r => r.StudentId)
            .Select(g => new { StudentId = g.Key, Spent = g.Sum(x => x.PointsSpent) })
            .ToDictionaryAsync(x => x.StudentId, x => x.Spent, ct);

        // Chuyên cần + BTVN từ bản ghi buổi học của lớp này.
        var sessionIds = await context.ClassSessions.AsNoTracking()
            .Where(s => s.ClassId == classId)
            .Select(s => s.Id)
            .ToListAsync(ct);

        var recAgg = await context.StudentSessionRecords.AsNoTracking()
            .Where(r => sessionIds.Contains(r.ClassSessionId) && studentIds.Contains(r.StudentId))
            .GroupBy(r => r.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                Total = g.Count(),
                Present = g.Count(x => x.Attendance == AttendanceStatus.Present || x.Attendance == AttendanceStatus.Late),
                HwAssigned = g.Count(x => x.Homework != HomeworkStatus.NotAssigned),
                HwDone = g.Count(x => x.Homework == HomeworkStatus.Completed || x.Homework == HomeworkStatus.CompletedWell)
            })
            .ToListAsync(ct);

        var result = roster.Select(s =>
        {
            var agg = pointAgg.FirstOrDefault(x => x.StudentId == s.Id);
            var balance = (agg?.Reward ?? 0) - (agg?.Penalty ?? 0) - redeemed.GetValueOrDefault(s.Id);

            var rec = recAgg.FirstOrDefault(x => x.StudentId == s.Id);
            var total = rec?.Total ?? 0;
            var present = rec?.Present ?? 0;
            var hwAssigned = rec?.HwAssigned ?? 0;
            var hwDone = rec?.HwDone ?? 0;
            var attRate = total > 0 ? Math.Round((decimal)present / total * 100, 1) : 0m;
            var hwRate = hwAssigned > 0 ? Math.Round((decimal)hwDone / hwAssigned * 100, 1) : 0m;

            return new ClassStudentOverviewDto(s.Id, s.FullName, balance, present, total, attRate, hwDone, hwAssigned, hwRate);
        }).ToList();

        return result;
    }

    public async Task<Result> EnrollAsync(Guid classId, EnrollStudentRequest request, CancellationToken ct = default)
    {
        var cls = await context.Classes.FirstOrDefaultAsync(c => c.Id == classId, ct);
        if (cls is null)
            return Result.Failure(NotFoundError);

        if (!await context.Students.AnyAsync(s => s.Id == request.StudentId, ct))
            return Result.Failure(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));

        var alreadyEnrolled = await context.Enrollments.AnyAsync(
            e => e.ClassId == classId && e.StudentId == request.StudentId && e.IsActive, ct);
        if (alreadyEnrolled)
            return Result.Failure(Error.Conflict("Class.AlreadyEnrolled", "Học sinh đã có trong lớp này."));

        var size = await context.Enrollments.CountAsync(e => e.ClassId == classId && e.IsActive, ct);
        if (size >= cls.MaxCapacity)
            return Result.Failure(Error.Conflict("Class.Full", "Lớp đã đủ sĩ số tối đa."));

        context.Enrollments.Add(new Enrollment
        {
            ClassId = classId,
            StudentId = request.StudentId,
            EnrolledOn = DateOnly.FromDateTime(DateTime.Now),
            IsActive = true
        });

        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> WithdrawAsync(Guid classId, Guid studentId, CancellationToken ct = default)
    {
        var enrollment = await context.Enrollments.FirstOrDefaultAsync(
            e => e.ClassId == classId && e.StudentId == studentId && e.IsActive, ct);
        if (enrollment is null)
            return Result.Failure(Error.NotFound("Class.EnrollmentNotFound", "Học sinh không có trong lớp này."));

        enrollment.IsActive = false;
        enrollment.WithdrawnOn = DateOnly.FromDateTime(DateTime.Now);
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<Result> ValidateTeacherAsync(Guid teacherId, CancellationToken ct)
    {
        if (!await userDirectory.ExistsAsync(teacherId, ct))
            return Result.Failure(Error.Validation("Class.TeacherNotFound", "Không tìm thấy người dùng giáo viên."));

        var isTeacher = await userDirectory.IsInRoleAsync(teacherId, AppRoles.Teacher, ct);
        var isAdmin = await userDirectory.IsInRoleAsync(teacherId, AppRoles.Admin, ct);
        if (!isTeacher && !isAdmin)
            return Result.Failure(Error.Validation("Class.NotATeacher", "Người dùng được gán không có vai trò Giáo viên."));

        return Result.Success();
    }

    private async Task<ClassDto> BuildClassDtoAsync(ClassRoom cls, CancellationToken ct)
    {
        var activeStudentIds = await context.Enrollments
            .Where(e => e.ClassId == cls.Id && e.IsActive)
            .Select(e => e.StudentId)
            .ToListAsync(ct);

        var currentSize = activeStudentIds.Count;

        decimal? averageScore = null;
        if (activeStudentIds.Count > 0)
        {
            var assessments = await context.StudentAssessments
                .Where(a => activeStudentIds.Contains(a.StudentId)
                            && a.Type == AssessmentType.Periodic
                            && a.OverallScore != null)
                .ToListAsync(ct);

            var latestPerStudent = assessments
                .GroupBy(a => a.StudentId)
                .Select(g => g.OrderByDescending(a => a.TakenOn).First().OverallScore!.Value)
                .ToList();

            if (latestPerStudent.Count > 0)
                averageScore = Math.Round(latestPerStudent.Average(), 2);
        }

        decimal attendanceRate = 0;
        var sessionIds = await context.ClassSessions
            .Where(s => s.ClassId == cls.Id)
            .Select(s => s.Id)
            .ToListAsync(ct);

        if (sessionIds.Count > 0)
        {
            var totalRecords = await context.StudentSessionRecords.CountAsync(r => sessionIds.Contains(r.ClassSessionId), ct);
            if (totalRecords > 0)
            {
                var present = await context.StudentSessionRecords
                    .CountAsync(r => sessionIds.Contains(r.ClassSessionId) && r.Attendance == AttendanceStatus.Present, ct);
                attendanceRate = Math.Round((decimal)present / totalRecords * 100, 1);
            }
        }

        var teacherName = (await userDirectory.GetDisplayNamesAsync([cls.TeacherId], ct)).GetValueOrDefault(cls.TeacherId);

        string? curriculumName = null;
        if (cls.CurriculumId is not null)
            curriculumName = (await context.Curriculums.FirstOrDefaultAsync(c => c.Id == cls.CurriculumId, ct))?.Name;

        return new ClassDto(
            cls.Id, cls.Name, cls.TeacherId, teacherName,
            cls.CurriculumId, curriculumName, cls.MaxCapacity, cls.Schedule, cls.StartDate,
            cls.IsActive, currentSize, averageScore, attendanceRate,
            cls.IsDeleted, cls.CreatedAt, cls.UpdatedAt);
    }
}
