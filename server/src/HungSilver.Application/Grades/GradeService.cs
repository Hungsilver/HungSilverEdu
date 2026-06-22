using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Grades;

public interface IGradeService
{
    Task<Result<List<GradeDto>>> GetAllAsync(bool includeInactive = false, CancellationToken ct = default);
    Task<Result<GradeDto>> CreateAsync(CreateGradeRequest request, CancellationToken ct = default);
    Task<Result<GradeDto>> UpdateAsync(Guid id, UpdateGradeRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class GradeService(
    IRepository<GradeCategory> grades,
    IRepository<ClassRoom> classes,
    IUnitOfWork unitOfWork,
    IValidator<CreateGradeRequest> createValidator,
    IValidator<UpdateGradeRequest> updateValidator) : IGradeService
{
    private static readonly Error NotFoundError = Error.NotFound("Grade.NotFound", "Không tìm thấy khối.");

    public async Task<Result<List<GradeDto>>> GetAllAsync(bool includeInactive = false, CancellationToken ct = default)
    {
        var items = await grades.FindAsync(g => includeInactive || g.IsActive, ct);
        return items.OrderBy(g => g.IndexOrder).ThenBy(g => g.Name).Select(ToDto).ToList();
    }

    public async Task<Result<GradeDto>> CreateAsync(CreateGradeRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<GradeDto>(validation.ToError("Grade.Validation"));

        var code = await ResolveCodeAsync(request.Code, request.Name, null, ct);
        if (code.IsFailure) return Result.Failure<GradeDto>(code.Error);

        var grade = new GradeCategory
        {
            Code = code.Value,
            Name = request.Name.Trim(),
            IndexOrder = request.IndexOrder,
            IsActive = request.IsActive
        };
        await grades.AddAsync(grade, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(grade);
    }

    public async Task<Result<GradeDto>> UpdateAsync(Guid id, UpdateGradeRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<GradeDto>(validation.ToError("Grade.Validation"));

        var grade = await grades.GetByIdAsync(id, ct: ct);
        if (grade is null)
            return Result.Failure<GradeDto>(NotFoundError);

        var code = await ResolveCodeAsync(request.Code, request.Name, grade.Code, ct);
        if (code.IsFailure) return Result.Failure<GradeDto>(code.Error);

        grade.Code = code.Value;
        grade.Name = request.Name.Trim();
        grade.IndexOrder = request.IndexOrder;
        grade.IsActive = request.IsActive;
        grades.Update(grade);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(grade);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var grade = await grades.GetByIdAsync(id, ct: ct);
        if (grade is null) return Result.Failure(NotFoundError);

        if (await classes.AnyAsync(c => c.GradeId == id, ct))
            return Result.Failure(Error.Conflict("Grade.HasClasses", "Không thể xóa khối khi vẫn còn lớp thuộc khối này."));

        grades.SoftDelete(grade);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    // Code trống → sinh slug từ tên (với counter nếu trùng); Code đã điền → normalize + kiểm trùng.
    private async Task<Result<string>> ResolveCodeAsync(string? requested, string name, string? currentCode, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(requested))
        {
            var slug = NameCodeGenerator.SlugCode(name);
            for (var i = 0; i <= 99; i++)
            {
                var candidate = i == 0 ? slug : $"{slug}{i}";
                if (!await grades.AnyAsync(g => g.Code == candidate, ct))
                    return candidate;
            }
            return UniqueCodeGenerator.Next("GR");
        }
        var code = requested.Trim().ToUpperInvariant().Replace(" ", "_");
        if (currentCode != null && currentCode == code) return code;
        return await grades.AnyAsync(g => g.Code == code, ct)
            ? Result.Failure<string>(Error.Conflict("Grade.DuplicateCode", $"Mã khối '{requested}' đã tồn tại."))
            : (Result<string>)code;
    }

    private static GradeDto ToDto(GradeCategory g) =>
        new(g.Id, g.Code, g.Name, g.IndexOrder, g.IsActive, g.IsDeleted, g.CreatedAt, g.UpdatedAt);
}
