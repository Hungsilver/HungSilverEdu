using System.Linq.Expressions;
using AutoMapper;
using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Students;

public interface IStudentService
{
    Task<Result<PagedResult<StudentDto>>> GetPagedAsync(PagedRequest request, bool includeDeleted = false, CancellationToken ct = default);
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
    IUnitOfWork unitOfWork,
    IMapper mapper,
    IUserDirectory userDirectory,
    IValidator<CreateStudentRequest> createValidator,
    IValidator<UpdateStudentRequest> updateValidator) : IStudentService
{
    private static readonly Error NotFoundError = Error.NotFound("Student.NotFound", "Không tìm thấy học sinh.");

    public async Task<Result<PagedResult<StudentDto>>> GetPagedAsync(PagedRequest request, bool includeDeleted = false, CancellationToken ct = default)
    {
        // Teacher chỉ thấy học sinh đang ghi danh ở lớp của mình.
        List<Guid>? allowedIds = null;
        if (!accessGuard.IsAdmin)
        {
            var myClasses = await classes.FindAsync(c => c.TeacherId == accessGuard.TeacherScopeId, ct);
            var myClassIds = myClasses.Select(c => c.Id).ToList();
            var myEnrollments = await enrollments.FindAsync(e => myClassIds.Contains(e.ClassId) && e.IsActive, ct);
            allowedIds = myEnrollments.Select(e => e.StudentId).Distinct().ToList();
        }

        var term = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim().ToLower();

        Expression<Func<Student, bool>> filter = allowedIds is null
            ? s => term == null || s.FullName.ToLower().Contains(term)
                   || (s.Phone != null && s.Phone.Contains(term))
                   || (s.ParentPhone != null && s.ParentPhone.Contains(term))
            : s => allowedIds.Contains(s.Id) && (term == null || s.FullName.ToLower().Contains(term)
                   || (s.Phone != null && s.Phone.Contains(term))
                   || (s.ParentPhone != null && s.ParentPhone.Contains(term)));

        var page = await students.GetPagedAsync(
            request.Page, request.PageSize, filter,
            request.SortBy ?? nameof(Student.CreatedAtUtc), request.SortDesc || request.SortBy is null,
            includeDeleted, ct);

        return page.Map(s => mapper.Map<StudentDto>(s));
    }

    public async Task<Result<StudentDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessStudentAsync(id, ct);
        if (access.IsFailure)
            return Result.Failure<StudentDto>(access.Error);

        var student = await students.GetByIdAsync(id, ct: ct);
        return student is null ? Result.Failure<StudentDto>(NotFoundError) : mapper.Map<StudentDto>(student);
    }

    public async Task<Result<StudentDto>> CreateAsync(CreateStudentRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<StudentDto>(validation.ToError("Student.Validation"));

        var student = new Student
        {
            FullName = request.FullName.Trim(),
            DateOfBirth = request.DateOfBirth,
            School = request.School?.Trim(),
            GradeLevel = request.GradeLevel?.Trim(),
            Phone = request.Phone?.Trim(),
            ParentName = request.ParentName?.Trim(),
            ParentPhone = request.ParentPhone?.Trim(),
            Address = request.Address?.Trim(),
            EnrollmentDate = request.EnrollmentDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            EnglishLevel = request.EnglishLevel?.Trim(),
            LearningGoal = request.LearningGoal?.Trim(),
            EntryScore = request.EntryScore,
            Curriculum = request.Curriculum?.Trim(),
            IsActive = request.IsActive
        };

        await students.AddAsync(student, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return mapper.Map<StudentDto>(student);
    }

    public async Task<Result<StudentDto>> UpdateAsync(Guid id, UpdateStudentRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<StudentDto>(validation.ToError("Student.Validation"));

        var student = await students.GetByIdAsync(id, ct: ct);
        if (student is null)
            return Result.Failure<StudentDto>(NotFoundError);

        student.FullName = request.FullName.Trim();
        student.DateOfBirth = request.DateOfBirth;
        student.School = request.School?.Trim();
        student.GradeLevel = request.GradeLevel?.Trim();
        student.Phone = request.Phone?.Trim();
        student.ParentName = request.ParentName?.Trim();
        student.ParentPhone = request.ParentPhone?.Trim();
        student.Address = request.Address?.Trim();
        if (request.EnrollmentDate.HasValue)
            student.EnrollmentDate = request.EnrollmentDate.Value;
        student.EnglishLevel = request.EnglishLevel?.Trim();
        student.LearningGoal = request.LearningGoal?.Trim();
        student.EntryScore = request.EntryScore;
        student.Curriculum = request.Curriculum?.Trim();
        student.IsActive = request.IsActive;

        students.Update(student);
        await unitOfWork.SaveChangesAsync(ct);

        return mapper.Map<StudentDto>(student);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var student = await students.GetByIdAsync(id, ct: ct);
        if (student is null)
            return Result.Failure(NotFoundError);

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

    public async Task<Result> LinkUserAsync(Guid studentId, Guid userId, CancellationToken ct = default)
    {
        var student = await students.GetByIdAsync(studentId, ct: ct);
        if (student is null)
            return Result.Failure(NotFoundError);

        if (!await userDirectory.ExistsAsync(userId, ct))
            return Result.Failure(Error.Validation("Student.UserNotFound", "Không tìm thấy tài khoản người dùng."));

        student.UserId = userId;
        students.Update(student);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}
