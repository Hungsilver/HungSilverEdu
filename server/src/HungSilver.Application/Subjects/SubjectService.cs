using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common;
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

/// <summary>Quản lý Môn học. Hiện thực ngay tại Application vì chỉ cần IRepository.</summary>
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
        return items.OrderBy(s => s.IndexOrder).ThenBy(s => s.Name).Select(ToDto).ToList();
    }

    public async Task<Result<SubjectDto>> CreateAsync(CreateSubjectRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<SubjectDto>(validation.ToError("Subject.Validation"));

        var code = await ResolveCodeAsync(request.Code, request.Name, null, ct);
        if (code.IsFailure) return Result.Failure<SubjectDto>(code.Error);

        var subject = new Subject
        {
            Code = code.Value,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            IndexOrder = request.IndexOrder,
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
        if (subject is null) return Result.Failure<SubjectDto>(NotFoundError);

        var code = await ResolveCodeAsync(request.Code, request.Name, subject.Code, ct);
        if (code.IsFailure) return Result.Failure<SubjectDto>(code.Error);

        subject.Code = code.Value;
        subject.Name = request.Name.Trim();
        subject.Description = request.Description?.Trim();
        subject.IndexOrder = request.IndexOrder;
        subject.IsActive = request.IsActive;
        subjects.Update(subject);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(subject);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var subject = await subjects.GetByIdAsync(id, ct: ct);
        if (subject is null) return Result.Failure(NotFoundError);

        if (await classes.AnyAsync(c => c.SubjectId == id, ct))
            return Result.Failure(Error.Conflict("Subject.HasClasses", "Không thể xóa môn khi vẫn còn lớp thuộc môn này."));

        subjects.SoftDelete(subject);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<Result<string>> ResolveCodeAsync(string? requested, string name, string? currentCode, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(requested))
        {
            var slug = NameCodeGenerator.SlugCode(name);
            for (var i = 0; i <= 99; i++)
            {
                var candidate = i == 0 ? slug : $"{slug}{i}";
                if (!await subjects.AnyAsync(s => s.Code == candidate, ct, includeDeleted: true))
                    return candidate;
            }
            return UniqueCodeGenerator.Next("SB");
        }
        var code = requested.Trim().ToUpperInvariant().Replace(" ", "_");
        if (currentCode != null && currentCode == code) return code;
        return await subjects.AnyAsync(s => s.Code == code, ct, includeDeleted: true)
            ? Result.Failure<string>(Error.Conflict("Subject.DuplicateCode", $"Mã môn học '{requested}' đã tồn tại."))
            : (Result<string>)code;
    }

    private static SubjectDto ToDto(Subject s) =>
        new(s.Id, s.Code, s.Name, s.Description, s.IndexOrder, s.IsActive);
}
