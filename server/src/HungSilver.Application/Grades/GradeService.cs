using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
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

        return items.OrderBy(g => g.SortOrder).ThenBy(g => g.Name)
            .Select(ToDto)
            .ToList();
    }

    public async Task<Result<GradeDto>> CreateAsync(CreateGradeRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<GradeDto>(validation.ToError("Grade.Validation"));

        var code = NormalizeCode(request.Code);
        if (await grades.AnyAsync(g => g.Code == code, ct))
            return Result.Failure<GradeDto>(Error.Conflict("Grade.DuplicateCode", $"Mã khối '{request.Code}' đã tồn tại."));

        var grade = new GradeCategory
        {
            Code = code,
            Name = request.Name.Trim(),
            SortOrder = request.SortOrder,
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

        var code = NormalizeCode(request.Code);
        if (grade.Code != code && await grades.AnyAsync(g => g.Code == code, ct))
            return Result.Failure<GradeDto>(Error.Conflict("Grade.DuplicateCode", $"Mã khối '{request.Code}' đã tồn tại."));

        grade.Code = code;
        grade.Name = request.Name.Trim();
        grade.SortOrder = request.SortOrder;
        grade.IsActive = request.IsActive;
        grades.Update(grade);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(grade);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var grade = await grades.GetByIdAsync(id, ct: ct);
        if (grade is null)
            return Result.Failure(NotFoundError);

        if (await classes.AnyAsync(c => c.GradeId == id, ct))
            return Result.Failure(Error.Conflict("Grade.HasClasses", "Không thể xóa khối khi vẫn còn lớp thuộc khối này."));

        grades.SoftDelete(grade);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static string NormalizeCode(string code) => code.Trim().ToUpperInvariant().Replace(" ", "_");

    private static GradeDto ToDto(GradeCategory g) =>
        new(g.Id, g.Code, g.Name, g.SortOrder, g.IsActive, g.IsDeleted, g.CreatedAt, g.UpdatedAt);
}
