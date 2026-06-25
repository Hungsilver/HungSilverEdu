using System.Linq.Expressions;
using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Accounts;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Students;

public interface IStudentService
{
    Task<Result<PagedResult<StudentDto>>> GetPagedAsync(PagedRequest request, bool includeDeleted = false, Guid? branchId = null, Guid? subjectId = null, Guid? gradeId = null, Guid? teacherProfileId = null, CancellationToken ct = default);
    Task<Result<StudentDto>> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<StudentDto>> CreateAsync(CreateStudentRequest request, CancellationToken ct = default);
    Task<Result<StudentDto>> UpdateAsync(Guid id, UpdateStudentRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<Result> RestoreAsync(Guid id, CancellationToken ct = default);
    Task<Result> LinkUserAsync(Guid studentId, Guid userId, CancellationToken ct = default);
}

public sealed class StudentService(
    IRepository<Student> students,
    IRepository<ClassRoom> classes,
    IRepository<Enrollment> enrollments,
    IClassAccessGuard accessGuard,
    ICurrentRelationCleanupService relationCleanup,
    IUnitOfWork unitOfWork,
    IUserDirectory userDirectory,
    IAccountProvisioningService accountProvisioning,
    IValidator<CreateStudentRequest> createValidator,
    IValidator<UpdateStudentRequest> updateValidator) : IStudentService
{
    private static readonly Error NotFoundError = Error.NotFound("Student.NotFound", "Không tìm thấy học sinh.");

    public async Task<Result<PagedResult<StudentDto>>> GetPagedAsync(
        PagedRequest request,
        bool includeDeleted = false,
        Guid? branchId = null,
        Guid? subjectId = null,
        Guid? gradeId = null,
        Guid? teacherProfileId = null,
        CancellationToken ct = default)
    {
        var scopedStudentIds = await ResolveFilteredStudentIdsAsync(branchId, subjectId, gradeId, teacherProfileId, ct);
        var scopeId = await accessGuard.GetTeacherScopeIdAsync(ct);
        if (scopeId is not null)
        {
            var teacherClassIds = (await classes.FindAsync(c => c.TeacherProfileId == scopeId, ct)).Select(c => c.Id).ToList();
            var teacherStudentIds = (await enrollments.FindAsync(e => teacherClassIds.Contains(e.ClassId) && e.IsActive, ct))
                .Select(e => e.StudentId).Distinct().ToHashSet();
            scopedStudentIds = scopedStudentIds is null
                ? teacherStudentIds
                : scopedStudentIds.Where(teacherStudentIds.Contains).ToHashSet();
        }

        var term = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim().ToLower();
        Expression<Func<Student, bool>> filter = s =>
            (scopedStudentIds == null || scopedStudentIds.Contains(s.Id))
            && (term == null
                || s.StudentCode.ToLower().Contains(term)
                || s.FullName.ToLower().Contains(term)
                || (s.Phone != null && s.Phone.Contains(term))
                || (s.ParentPhone != null && s.ParentPhone.Contains(term)));

        var page = await students.GetPagedAsync(
            request.Page, request.PageSize, filter,
            request.SortBy ?? nameof(Student.CreatedAt), request.SortDesc || request.SortBy is null,
            includeDeleted && accessGuard.IsAdmin, ct);

        var items = await ToDtosAsync(page.Items.ToList(), includeClasses: true, ct);
        return new PagedResult<StudentDto>
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalCount = page.TotalCount
        };
    }

    public async Task<Result<StudentDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(id, ct);
        if (access.IsFailure)
            return Result.Failure<StudentDto>(access.Error);

        var student = await students.GetByIdAsync(id, ct: ct);
        return student is null
            ? Result.Failure<StudentDto>(NotFoundError)
            : (await ToDtosAsync([student], includeClasses: true, ct))[0];
    }

    public async Task<Result<StudentDto>> CreateAsync(CreateStudentRequest request, CancellationToken ct = default)
    {
        // Học sinh "trần" (không gắn lớp) chỉ Admin tạo; Giáo viên tạo học sinh trong lớp qua StudentAccountService.
        if (!accessGuard.IsAdmin)
            return Result.Failure<StudentDto>(Error.Forbidden("Student.CreateNotAllowed", "Giáo viên tạo học sinh trong lớp."));

        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<StudentDto>(validation.ToError("Student.Validation"));

        var code = await ResolveStudentCodeAsync(request.StudentCode, request.FullName, request.DateOfBirth, request.GradeLevel, null, ct);
        if (code.IsFailure)
            return Result.Failure<StudentDto>(code.Error);

        var student = new Student
        {
            StudentCode = code.Value,
            FullName = request.FullName.Trim(),
            DateOfBirth = request.DateOfBirth,
            School = Clean(request.School),
            GradeLevel = Clean(request.GradeLevel),
            Phone = Clean(request.Phone),
            ParentName = Clean(request.ParentName),
            ParentPhone = Clean(request.ParentPhone),
            Address = Clean(request.Address),
            Email = Clean(request.Email),
            Note = Clean(request.Note),
            EnrollmentDate = request.EnrollmentDate ?? DateOnly.FromDateTime(DateTime.Now),
            EnglishLevel = Clean(request.EnglishLevel),
            LearningGoal = Clean(request.LearningGoal),
            Curriculum = Clean(request.Curriculum),
            IsActive = request.IsActive
        };

        await students.AddAsync(student, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return (await ToDtosAsync([student], includeClasses: true, ct))[0];
    }

    public async Task<Result<StudentDto>> UpdateAsync(Guid id, UpdateStudentRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<StudentDto>(validation.ToError("Student.Validation"));

        var access = await accessGuard.EnsureCanAccessStudentAsync(id, ct);
        if (access.IsFailure)
            return Result.Failure<StudentDto>(access.Error);

        var student = await students.GetByIdAsync(id, ct: ct);
        if (student is null)
            return Result.Failure<StudentDto>(NotFoundError);

        var code = await ResolveStudentCodeAsync(request.StudentCode, request.FullName, request.DateOfBirth, request.GradeLevel, id, ct);
        if (code.IsFailure)
            return Result.Failure<StudentDto>(code.Error);

        student.StudentCode = code.Value;
        student.FullName = request.FullName.Trim();
        student.DateOfBirth = request.DateOfBirth;
        student.School = Clean(request.School);
        student.GradeLevel = Clean(request.GradeLevel);
        student.Phone = Clean(request.Phone);
        student.ParentName = Clean(request.ParentName);
        student.ParentPhone = Clean(request.ParentPhone);
        student.Address = Clean(request.Address);
        student.Email = Clean(request.Email);
        student.Note = Clean(request.Note);
        if (request.EnrollmentDate.HasValue)
            student.EnrollmentDate = request.EnrollmentDate.Value;
        student.EnglishLevel = Clean(request.EnglishLevel);
        student.LearningGoal = Clean(request.LearningGoal);
        student.Curriculum = Clean(request.Curriculum);
        student.IsActive = request.IsActive;

        students.Update(student);
        await unitOfWork.SaveChangesAsync(ct);

        return (await ToDtosAsync([student], includeClasses: true, ct))[0];
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(id, ct);
        if (access.IsFailure)
            return access;

        var student = await students.GetByIdAsync(id, ct: ct);
        if (student is null)
            return Result.Failure(NotFoundError);

        await relationCleanup.SoftDeleteActiveEnrollmentsForStudentAsync(id, ct);
        students.SoftDelete(student);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var restored = await students.RestoreAsync(id, ct);
        if (!restored)
            return Result.Failure(NotFoundError);

        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    public Task<Result> LinkUserAsync(Guid studentId, Guid userId, CancellationToken ct = default) =>
        // Liên kết tài khoản (role User) có sẵn vào học sinh — qua service cấp tài khoản chung
        // (kiểm vai trò + enforce 1-1 + lưới an toàn unique index).
        accountProvisioning.LinkStudentAsync(studentId, userId, ct);

    private async Task<HashSet<Guid>?> ResolveFilteredStudentIdsAsync(Guid? branchId, Guid? subjectId, Guid? gradeId, Guid? teacherProfileId, CancellationToken ct)
    {
        if (branchId is null && subjectId is null && gradeId is null && teacherProfileId is null)
            return null;

        var classList = await classes.FindAsync(c =>
            (branchId == null || c.BranchId == branchId)
            && (subjectId == null || c.SubjectId == subjectId)
            && (gradeId == null || c.GradeId == gradeId)
            && (teacherProfileId == null || c.TeacherProfileId == teacherProfileId), ct);
        var classIds = classList.Select(c => c.Id).ToList();
        return (await enrollments.FindAsync(e => classIds.Contains(e.ClassId) && e.IsActive, ct))
            .Select(e => e.StudentId)
            .Distinct()
            .ToHashSet();
    }

    private async Task<Result<string>> ResolveStudentCodeAsync(string? requested, string fullName, DateOnly? dateOfBirth, string? gradeLevel, Guid? currentId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            var manual = requested.Trim().ToUpperInvariant();
            var dup = await students.AnyAsync(s => s.StudentCode == manual && (currentId == null || s.Id != currentId.Value), ct);
            return dup
                ? Result.Failure<string>(Error.Conflict("Student.DuplicateCode", $"Mã học viên '{manual}' đã tồn tại."))
                : (Result<string>)manual;
        }
        // Tự sinh theo rule: nếu có ngày sinh dùng năm sinh, nếu không dùng tên khối
        for (var i = 0; i <= 99; i++)
        {
            var generated = NameCodeGenerator.GenerateStudentCode(fullName, dateOfBirth, gradeLevel, i);
            if (!await students.AnyAsync(s => s.StudentCode == generated && (currentId == null || s.Id != currentId.Value), ct))
                return generated;
        }
        return UniqueCodeGenerator.Next("HS");
    }

    private async Task<List<StudentDto>> ToDtosAsync(List<Student> items, bool includeClasses, CancellationToken ct)
    {
        var classMap = includeClasses
            ? await LoadStudentClassesAsync(items.Select(s => s.Id).ToList(), ct)
            : [];

        var userIds = items.Where(s => s.UserId.HasValue).Select(s => s.UserId!.Value).ToList();
        var accounts = userIds.Count > 0
            ? await userDirectory.GetAccountInfosAsync(userIds, ct)
            : [];

        return items.Select(s =>
        {
            var acc = s.UserId.HasValue ? accounts.GetValueOrDefault(s.UserId.Value) : null;
            return new StudentDto(
                s.Id, s.StudentCode, s.FullName, s.DateOfBirth, s.School, s.GradeLevel,
                s.Phone, s.ParentName, s.ParentPhone, s.Address, s.Email, s.Note,
                s.EnrollmentDate, s.EnglishLevel, s.LearningGoal, s.Curriculum, s.UserId,
                acc?.UserName, acc?.IsLocked ?? false, acc?.MustChangePassword ?? false,
                s.IsActive, s.IsDeleted, s.CreatedAt, s.UpdatedAt,
                classMap.GetValueOrDefault(s.Id) ?? []);
        }).ToList();
    }

    private async Task<Dictionary<Guid, IReadOnlyList<StudentClassDto>>> LoadStudentClassesAsync(List<Guid> studentIds, CancellationToken ct)
    {
        if (studentIds.Count == 0)
            return [];

        var enrollmentRows = await enrollments.FindAsync(e => studentIds.Contains(e.StudentId) && e.IsActive, ct);
        var classIds = enrollmentRows.Select(e => e.ClassId).Distinct().ToList();
        var classRows = await classes.FindAsync(c => classIds.Contains(c.Id), ct);
        var classMap = classRows.ToDictionary(c => c.Id);

        var rows = enrollmentRows
            .Where(e => classMap.ContainsKey(e.ClassId))
            .Select(e => new { e.StudentId, e.EnrolledOn, Class = classMap[e.ClassId] })
            .OrderBy(x => x.Class.Name)
            .ToList();

        return rows.GroupBy(x => x.StudentId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<StudentClassDto>)g.Select(x => new StudentClassDto(
                    x.Class.Id, x.Class.ClassCode, x.Class.Name,
                    x.Class.TeacherProfileId, x.Class.TeacherName,
                    x.Class.BranchId, x.Class.BranchCode, x.Class.BranchName,
                    x.Class.SubjectId, x.Class.SubjectName,
                    x.Class.GradeId, x.Class.GradeName,
                    x.Class.TuitionFee, x.EnrolledOn)).ToList());
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
