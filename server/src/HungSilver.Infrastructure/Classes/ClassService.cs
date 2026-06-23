using ClosedXML.Excel;
using FluentValidation;
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
    ICurrentRelationCleanupService relationCleanup,
    IValidator<CreateClassRequest> createValidator,
    IValidator<UpdateClassRequest> updateValidator) : IClassService
{
    private static readonly XLColor HeaderIndigo = XLColor.FromHtml("#4F46E5");
    private static readonly XLColor HeaderYellow = XLColor.FromHtml("#FFFFC8");

    private static readonly Error NotFoundError = Error.NotFound("Class.NotFound", "Không tìm thấy lớp học.");

    public async Task<Result<PagedResult<ClassListItemDto>>> GetPagedAsync(
        PagedRequest request,
        bool includeDeleted = false,
        Guid? branchId = null,
        Guid? subjectId = null,
        Guid? gradeId = null,
        Guid? teacherProfileId = null,
        CancellationToken ct = default)
    {
        var query = includeDeleted && accessGuard.IsAdmin
            ? context.Classes.IgnoreQueryFilters().AsNoTracking()
            : context.Classes.AsNoTracking();

        var scopeId = await accessGuard.GetTeacherScopeIdAsync(ct);
        if (scopeId is not null)
            query = query.Where(c => c.TeacherProfileId == scopeId);

        if (branchId is not null)
            query = query.Where(c => c.BranchId == branchId);
        if (subjectId is not null)
            query = query.Where(c => c.SubjectId == subjectId);
        if (gradeId is not null)
            query = query.Where(c => c.GradeId == gradeId);
        if (teacherProfileId is not null)
            query = query.Where(c => c.TeacherProfileId == teacherProfileId);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(c =>
                c.ClassCode.ToLower().Contains(term)
                || c.Name.ToLower().Contains(term)
                || (c.TeacherName != null && c.TeacherName.ToLower().Contains(term)));
        }

        var total = await query.CountAsync(ct);
        var page = Math.Max(request.Page, 1);
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        var sizes = await LoadClassSizesAsync(items.Select(c => c.Id).ToList(), ct);
        var dtos = items.Select(c => ToListDto(c, sizes.GetValueOrDefault(c.Id))).ToList();

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

        var teacherProfileId = await ResolveTeacherProfileIdAsync(request.TeacherProfileId, ct);
        if (teacherProfileId.IsFailure)
            return Result.Failure<ClassDto>(teacherProfileId.Error);

        var snapshot = await BuildSnapshotAsync(teacherProfileId.Value, request.BranchId, request.SubjectId, request.GradeId, ct);
        if (snapshot.IsFailure)
            return Result.Failure<ClassDto>(snapshot.Error);

        var classCode = await ResolveClassCodeAsync(request.ClassCode, null, ct);
        if (classCode.IsFailure)
            return Result.Failure<ClassDto>(classCode.Error);

        var cls = new ClassRoom
        {
            ClassCode = classCode.Value,
            Name = request.Name.Trim(),
            TeacherProfileId = teacherProfileId.Value,
            TeacherId = snapshot.Value.TeacherUserId ?? Guid.Empty,
            TeacherName = snapshot.Value.TeacherName,
            BranchId = Normalize(request.BranchId),
            BranchCode = snapshot.Value.BranchCode,
            BranchName = snapshot.Value.BranchName,
            SubjectId = Normalize(request.SubjectId),
            SubjectName = snapshot.Value.SubjectName,
            GradeId = Normalize(request.GradeId),
            GradeName = snapshot.Value.GradeName,
            GradeBand = snapshot.Value.GradeName,
            TuitionFee = request.TuitionFee,
            CurriculumId = Normalize(request.CurriculumId),
            MaxCapacity = request.MaxCapacity,
            Schedule = Clean(request.Schedule),
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

        var access = await accessGuard.EnsureCanAccessClassAsync(id, ct);
        if (access.IsFailure)
            return Result.Failure<ClassDto>(access.Error);

        var teacherProfileId = await ResolveTeacherProfileIdAsync(request.TeacherProfileId, ct);
        if (teacherProfileId.IsFailure)
            return Result.Failure<ClassDto>(teacherProfileId.Error);

        var snapshot = await BuildSnapshotAsync(teacherProfileId.Value, request.BranchId, request.SubjectId, request.GradeId, ct);
        if (snapshot.IsFailure)
            return Result.Failure<ClassDto>(snapshot.Error);

        var classCode = await ResolveClassCodeAsync(request.ClassCode, id, ct);
        if (classCode.IsFailure)
            return Result.Failure<ClassDto>(classCode.Error);

        cls.ClassCode = classCode.Value;
        cls.Name = request.Name.Trim();
        cls.TeacherProfileId = teacherProfileId.Value;
        cls.TeacherId = snapshot.Value.TeacherUserId ?? Guid.Empty;
        cls.TeacherName = snapshot.Value.TeacherName;
        cls.BranchId = Normalize(request.BranchId);
        cls.BranchCode = snapshot.Value.BranchCode;
        cls.BranchName = snapshot.Value.BranchName;
        cls.SubjectId = Normalize(request.SubjectId);
        cls.SubjectName = snapshot.Value.SubjectName;
        cls.GradeId = Normalize(request.GradeId);
        cls.GradeName = snapshot.Value.GradeName;
        cls.GradeBand = snapshot.Value.GradeName;
        cls.TuitionFee = request.TuitionFee;
        cls.CurriculumId = Normalize(request.CurriculumId);
        cls.MaxCapacity = request.MaxCapacity;
        cls.Schedule = Clean(request.Schedule);
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

        var access = await accessGuard.EnsureCanAccessClassAsync(id, ct);
        if (access.IsFailure)
            return access;

        await relationCleanup.SoftDeleteInvalidActiveEnrollmentsForClassAsync(id, ct);
        var hasStudents = await relationCleanup.HasValidActiveEnrollmentsForClassAsync(id, ct);
        if (hasStudents)
            return Result.Failure(Error.Conflict("Class.HasStudents", "Không thể xóa lớp khi vẫn còn học sinh đang học."));

        await relationCleanup.SoftDeleteCurrentClassRelationsAsync(id, ct);
        context.Classes.Remove(cls);
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
        // Đổi giáo viên phụ trách là thao tác điều phối — chỉ Admin (GV không tự chuyển lớp sang người khác).
        if (!accessGuard.IsAdmin)
            return Result.Failure(Error.Forbidden("Class.AssignTeacherForbidden", "Chỉ quản trị viên được đổi giáo viên phụ trách."));

        var cls = await context.Classes.FirstOrDefaultAsync(c => c.Id == classId, ct);
        if (cls is null)
            return Result.Failure(NotFoundError);

        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return access;

        var snapshot = await BuildSnapshotAsync(request.TeacherProfileId, cls.BranchId, cls.SubjectId, cls.GradeId, ct);
        if (snapshot.IsFailure)
            return snapshot;

        cls.TeacherProfileId = request.TeacherProfileId;
        cls.TeacherId = snapshot.Value.TeacherUserId ?? Guid.Empty;
        cls.TeacherName = snapshot.Value.TeacherName;
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
            select new RosterItemDto(e.Id, s.Id, s.StudentCode, s.FullName, s.Phone, s.ParentPhone, s.Email, s.Note, e.EnrolledOn, s.UserId))
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
            select new { s.Id, s.StudentCode, s.FullName })
            .ToListAsync(ct);

        if (roster.Count == 0)
            return new List<ClassStudentOverviewDto>();

        var studentIds = roster.Select(r => r.Id).ToList();

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

            return new ClassStudentOverviewDto(s.Id, s.StudentCode, s.FullName, balance, present, total, attRate, hwDone, hwAssigned, hwRate);
        }).ToList();

        return result;
    }

    public async Task<Result> EnrollAsync(Guid classId, EnrollStudentRequest request, CancellationToken ct = default)
    {
        var cls = await context.Classes.FirstOrDefaultAsync(c => c.Id == classId, ct);
        if (cls is null)
            return Result.Failure(NotFoundError);

        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return access;

        if (!await context.Students.AnyAsync(s => s.Id == request.StudentId, ct))
            return Result.Failure(Error.NotFound("Student.NotFound", "Không tìm thấy học sinh."));

        var alreadyEnrolled = await context.Enrollments.AnyAsync(
            e => e.ClassId == classId && e.StudentId == request.StudentId && e.IsActive, ct);
        if (alreadyEnrolled)
            return Result.Failure(Error.Conflict("Class.AlreadyEnrolled", "Học sinh đã có trong lớp này."));

        var size = (await relationCleanup.LoadValidClassSizesAsync([classId], ct)).GetValueOrDefault(classId);
        if (size >= cls.MaxCapacity)
            return Result.Failure(Error.Conflict("Class.Full", "Lớp đã đủ sĩ số tối đa."));

        context.Enrollments.Add(new Enrollment
        {
            ClassId = classId,
            StudentId = request.StudentId,
            EnrolledOn = DateOnly.FromDateTime(DateTime.Now),
            IsActive = true
        });

        try
        {
            await context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return Result.Failure(Error.Conflict("Class.AlreadyEnrolled", "Học sinh đã có trong lớp này."));
        }
        return Result.Success();
    }

    public async Task<Result> WithdrawAsync(Guid classId, Guid studentId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure)
            return access;

        var enrollment = await context.Enrollments.FirstOrDefaultAsync(
            e => e.ClassId == classId && e.StudentId == studentId && e.IsActive, ct);
        if (enrollment is null)
            return Result.Failure(Error.NotFound("Class.EnrollmentNotFound", "Học sinh không có trong lớp này."));

        enrollment.IsActive = false;
        enrollment.WithdrawnOn = DateOnly.FromDateTime(DateTime.Now);
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<ClassDto> BuildClassDtoAsync(ClassRoom cls, CancellationToken ct)
    {
        var activeStudentIds = (await relationCleanup.LoadValidActiveStudentIdsByClassesAsync([cls.Id], ct)).ToList();

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
                // Có mặt = Present hoặc Late (đi muộn vẫn tính chuyên cần) — khớp GetOverviewAsync.
                var present = await context.StudentSessionRecords
                    .CountAsync(r => sessionIds.Contains(r.ClassSessionId)
                        && (r.Attendance == AttendanceStatus.Present || r.Attendance == AttendanceStatus.Late), ct);
                attendanceRate = Math.Round((decimal)present / totalRecords * 100, 1);
            }
        }

        string? curriculumName = null;
        if (cls.CurriculumId is not null)
            curriculumName = (await context.Curriculums.FirstOrDefaultAsync(c => c.Id == cls.CurriculumId, ct))?.Name;

        return new ClassDto(
            cls.Id, cls.ClassCode, cls.Name,
            cls.TeacherProfileId, cls.TeacherName,
            cls.BranchId, cls.BranchCode, cls.BranchName,
            cls.SubjectId, cls.SubjectName,
            cls.GradeId, cls.GradeName,
            cls.TuitionFee,
            cls.CurriculumId, curriculumName, cls.MaxCapacity, cls.Schedule, cls.StartDate,
            cls.IsActive, currentSize, averageScore, attendanceRate,
            cls.IsDeleted, cls.CreatedAt, cls.UpdatedAt);
    }

    private async Task<Result<ClassSnapshot>> BuildSnapshotAsync(Guid teacherProfileId, Guid? branchId, Guid? subjectId, Guid? gradeId, CancellationToken ct)
    {
        var teacher = await context.TeacherProfiles.AsNoTracking().FirstOrDefaultAsync(t => t.Id == teacherProfileId && t.IsActive, ct);
        if (teacher is null)
            return Result.Failure<ClassSnapshot>(Error.Validation("Class.TeacherNotFound", "Không tìm thấy giáo viên."));

        Branch? branch = null;
        if (Normalize(branchId) is Guid bid)
        {
            branch = await context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == bid && b.IsActive, ct);
            if (branch is null)
                return Result.Failure<ClassSnapshot>(Error.Validation("Class.BranchNotFound", "Không tìm thấy cơ sở."));
        }

        Subject? subject = null;
        if (Normalize(subjectId) is Guid sid)
        {
            subject = await context.Subjects.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sid && s.IsActive, ct);
            if (subject is null)
                return Result.Failure<ClassSnapshot>(Error.Validation("Class.SubjectNotFound", "Không tìm thấy môn học."));
        }

        GradeCategory? grade = null;
        if (Normalize(gradeId) is Guid gid)
        {
            grade = await context.GradeCategories.AsNoTracking().FirstOrDefaultAsync(g => g.Id == gid && g.IsActive, ct);
            if (grade is null)
                return Result.Failure<ClassSnapshot>(Error.Validation("Class.GradeNotFound", "Không tìm thấy khối."));
        }

        return new ClassSnapshot(
            teacher.UserId, teacher.FullName,
            branch?.Code, branch?.Name,
            subject?.Name,
            grade?.Name);
    }

    private async Task<Result<string>> ResolveClassCodeAsync(string? requested, Guid? currentId, CancellationToken ct)
    {
        var code = string.IsNullOrWhiteSpace(requested)
            ? UniqueCodeGenerator.Next("LH")
            : requested.Trim().ToUpperInvariant();

        var duplicate = await context.Classes.IgnoreQueryFilters()
            .AnyAsync(c => c.ClassCode == code && (currentId == null || c.Id != currentId), ct);
        return duplicate
            ? Result.Failure<string>(Error.Conflict("Class.DuplicateCode", $"Mã lớp '{code}' đã tồn tại."))
            : code;
    }

    private async Task<Dictionary<Guid, int>> LoadClassSizesAsync(List<Guid> classIds, CancellationToken ct)
    {
        if (classIds.Count == 0)
            return [];
        return await relationCleanup.LoadValidClassSizesAsync(classIds, ct);
    }

    private static ClassListItemDto ToListDto(ClassRoom c, int currentSize) => new(
        c.Id, c.ClassCode, c.Name,
        c.TeacherProfileId, c.TeacherName,
        c.BranchId, c.BranchCode, c.BranchName,
        c.SubjectId, c.SubjectName,
        c.GradeId, c.GradeName,
        c.TuitionFee, c.MaxCapacity, currentSize,
        c.IsActive, c.IsDeleted, c.CreatedAt);

    public async Task<Result<byte[]>> ExportAsync(string? search = null, Guid? branchId = null, Guid? subjectId = null, Guid? gradeId = null, Guid? teacherProfileId = null, CancellationToken ct = default)
    {
        var query = context.Classes.AsNoTracking().AsQueryable();

        var scopeId = await accessGuard.GetTeacherScopeIdAsync(ct);
        if (scopeId is not null)
            query = query.Where(c => c.TeacherProfileId == scopeId);

        if (branchId is not null)
            query = query.Where(c => c.BranchId == branchId);
        if (subjectId is not null)
            query = query.Where(c => c.SubjectId == subjectId);
        if (gradeId is not null)
            query = query.Where(c => c.GradeId == gradeId);
        if (teacherProfileId is not null)
            query = query.Where(c => c.TeacherProfileId == teacherProfileId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c =>
                c.ClassCode.ToLower().Contains(term)
                || c.Name.ToLower().Contains(term)
                || (c.TeacherName != null && c.TeacherName.ToLower().Contains(term)));
        }

        var items = await query.OrderByDescending(c => c.CreatedAt).ToListAsync(ct);
        var sizes = await LoadClassSizesAsync(items.Select(c => c.Id).ToList(), ct);

        using var wb = new XLWorkbook();

        // Sheet 1 — Data
        var ws = wb.Worksheets.Add("Data");
        var dataHeaders = new[] { "STT", "Mã lớp", "Tên lớp", "Giáo viên", "Môn học", "Khối", "Cơ sở", "Học phí", "Sĩ số", "Sĩ số tối đa", "Trạng thái" };
        for (var i = 0; i < dataHeaders.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = dataHeaders[i];
            ApplyHeaderStyle(cell, HeaderIndigo, XLColor.White);
        }

        for (var i = 0; i < items.Count; i++)
        {
            var c = items[i];
            var row = i + 2;
            ws.Cell(row, 1).Value = i + 1;
            ws.Cell(row, 2).Value = c.ClassCode;
            ws.Cell(row, 3).Value = c.Name;
            ws.Cell(row, 4).Value = c.TeacherName ?? "";
            ws.Cell(row, 5).Value = c.SubjectName ?? "";
            ws.Cell(row, 6).Value = c.GradeName ?? "";
            ws.Cell(row, 7).Value = string.IsNullOrWhiteSpace(c.BranchName) ? (c.BranchCode ?? "") : c.BranchName;
            ws.Cell(row, 8).Value = c.TuitionFee;
            ws.Cell(row, 9).Value = sizes.GetValueOrDefault(c.Id);
            ws.Cell(row, 10).Value = c.MaxCapacity;
            ws.Cell(row, 11).Value = c.IsActive ? "Đang mở" : "Đã đóng";
        }
        ws.Columns().AdjustToContents();

        // Sheet 2 — Danh mục
        var grades = await context.GradeCategories.AsNoTracking().OrderBy(g => g.IndexOrder).Select(g => g.Name).ToListAsync(ct);
        var teachers = await context.TeacherProfiles.AsNoTracking().OrderBy(t => t.FullName).Select(t => t.FullName).ToListAsync(ct);
        var classNames = await context.Classes.AsNoTracking().OrderBy(c => c.Name).Select(c => c.Name).ToListAsync(ct);
        var branches = await context.Branches.AsNoTracking().OrderBy(b => b.IndexOrder).Select(b => b.Name).ToListAsync(ct);
        var subjects = await context.Subjects.AsNoTracking().OrderBy(s => s.IndexOrder).Select(s => s.Name).ToListAsync(ct);

        var ws2 = wb.Worksheets.Add("Danh mục");
        var catHeaders = new[] { "Khối", "Giáo viên", "Lớp", "Cơ sở", "Môn học" };
        var catData = new[] { grades, teachers, classNames, branches, subjects };
        for (var col = 0; col < catHeaders.Length; col++)
        {
            var cell = ws2.Cell(1, col + 1);
            cell.Value = catHeaders[col];
            ApplyHeaderStyle(cell, HeaderYellow, HeaderIndigo);
            for (var rowIdx = 0; rowIdx < catData[col].Count; rowIdx++)
                ws2.Cell(rowIdx + 2, col + 1).Value = catData[col][rowIdx];
        }
        ws2.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    /// <summary>
    /// Admin được gán lớp cho bất kỳ giáo viên nào; Giáo viên bị ép gán cho chính mình (scope),
    /// bỏ qua giá trị client gửi. GV chưa liên kết hồ sơ → Forbidden.
    /// </summary>
    private async Task<Result<Guid>> ResolveTeacherProfileIdAsync(Guid requested, CancellationToken ct)
    {
        if (accessGuard.IsAdmin)
            return requested;

        var scopeId = await accessGuard.GetTeacherScopeIdAsync(ct);
        return scopeId is null || scopeId.Value == Guid.Empty
            ? Result.Failure<Guid>(Error.Forbidden("Class.NoTeacherProfile", "Tài khoản giáo viên chưa liên kết hồ sơ giáo viên."))
            : scopeId.Value;
    }

    private static Guid? Normalize(Guid? id) => id is null || id == Guid.Empty ? null : id;

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static void ApplyHeaderStyle(IXLCell cell, XLColor fillColor, XLColor fontColor)
    {
        cell.Style.Font.Bold = true;
        cell.Style.Font.FontColor = fontColor;
        cell.Style.Fill.BackgroundColor = fillColor;
    }

    private sealed record ClassSnapshot(
        Guid? TeacherUserId,
        string TeacherName,
        string? BranchCode,
        string? BranchName,
        string? SubjectName,
        string? GradeName);
}
