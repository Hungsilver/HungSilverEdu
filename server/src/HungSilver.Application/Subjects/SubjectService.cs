using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Subjects;

public interface ISubjectService
{
    Task<Result<List<SubjectDto>>> GetAllAsync(bool includeInactive = false, CancellationToken ct = default);
    Task<Result<SubjectDto>> CreateAsync(CreateSubjectRequest request, CancellationToken ct = default);
    Task<Result<SubjectDto>> UpdateAsync(Guid id, UpdateSubjectRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Quản lý Môn học (Đợt 7). Hiện thực ngay tại Application vì chỉ cần IRepository — như ProductService.</summary>
public sealed class SubjectService(
    IRepository<Subject> subjects,
    IRepository<ClassRoom> classes,
    IUnitOfWork unitOfWork,
    IValidator<CreateSubjectRequest> createValidator,
    IValidator<UpdateSubjectRequest> updateValidator) : ISubjectService
{
    private static readonly Error NotFoundError = Error.NotFound("Subject.NotFound", "Không tìm thấy môn học.");

    public async Task<Result<List<SubjectDto>>> GetAllAsync(bool includeInactive = false, CancellationToken ct = default)
    {
        var items = await subjects.FindAsync(s => includeInactive || s.IsActive, ct);

        return items
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(ToDto)
            .ToList();
    }

    public async Task<Result<SubjectDto>> CreateAsync(CreateSubjectRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<SubjectDto>(validation.ToError("Subject.Validation"));

        var code = NormalizeCode(request.Code);
        if (await subjects.AnyAsync(s => s.Code == code, ct))
            return Result.Failure<SubjectDto>(Error.Conflict("Subject.DuplicateCode", $"Mã môn học '{request.Code}' đã tồn tại."));

        var subject = new Subject
        {
            Code = code,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            SortOrder = request.SortOrder,
            IsActive = request.IsActive
        };
        await subjects.AddAsync(subject, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(subject);
    }

    public async Task<Result<SubjectDto>> UpdateAsync(Guid id, UpdateSubjectRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<SubjectDto>(validation.ToError("Subject.Validation"));

        var subject = await subjects.GetByIdAsync(id, ct: ct);
        if (subject is null)
            return Result.Failure<SubjectDto>(NotFoundError);

        var code = NormalizeCode(request.Code);
        if (subject.Code != code && await subjects.AnyAsync(s => s.Code == code, ct))
            return Result.Failure<SubjectDto>(Error.Conflict("Subject.DuplicateCode", $"Mã môn học '{request.Code}' đã tồn tại."));

        subject.Code = code;
        subject.Name = request.Name.Trim();
        subject.Description = request.Description?.Trim();
        subject.SortOrder = request.SortOrder;
        subject.IsActive = request.IsActive;
        subjects.Update(subject);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(subject);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var subject = await subjects.GetByIdAsync(id, ct: ct);
        if (subject is null)
            return Result.Failure(NotFoundError);

        // Không FK → tự kiểm: chặn xóa môn còn lớp đang gắn.
        if (await classes.AnyAsync(c => c.SubjectId == id, ct))
            return Result.Failure(Error.Conflict("Subject.HasClasses", "Không thể xóa môn khi vẫn còn lớp thuộc môn này."));

        subjects.SoftDelete(subject);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static string NormalizeCode(string code) => code.Trim().ToUpperInvariant().Replace(" ", "_");

    private static SubjectDto ToDto(Subject s) =>
        new(s.Id, s.Code, s.Name, s.Description, s.SortOrder, s.IsActive);
}
