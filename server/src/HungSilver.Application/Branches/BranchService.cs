using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Branches;

public interface IBranchService
{
    Task<Result<List<BranchDto>>> GetAllAsync(bool includeInactive = false, CancellationToken ct = default);
    Task<Result<BranchDto>> CreateAsync(CreateBranchRequest request, CancellationToken ct = default);
    Task<Result<BranchDto>> UpdateAsync(Guid id, UpdateBranchRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class BranchService(
    IRepository<Branch> branches,
    IRepository<ClassRoom> classes,
    IUnitOfWork unitOfWork,
    IValidator<CreateBranchRequest> createValidator,
    IValidator<UpdateBranchRequest> updateValidator) : IBranchService
{
    private static readonly Error NotFoundError = Error.NotFound("Branch.NotFound", "Không tìm thấy cơ sở.");

    public async Task<Result<List<BranchDto>>> GetAllAsync(bool includeInactive = false, CancellationToken ct = default)
    {
        var list = await branches.FindAsync(b => includeInactive || b.IsActive, ct);
        return list.OrderBy(b => b.IndexOrder).ThenBy(b => b.Name).Select(ToDto).ToList();
    }

    public async Task<Result<BranchDto>> CreateAsync(CreateBranchRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<BranchDto>(validation.ToError("Branch.Validation"));

        var code = await ResolveCodeAsync(request.Code, request.Name, null, ct);
        if (code.IsFailure) return Result.Failure<BranchDto>(code.Error);

        var branch = new Branch
        {
            Code = code.Value,
            Name = request.Name.Trim(),
            Address = request.Address?.Trim(),
            Phone = request.Phone?.Trim(),
            IndexOrder = request.IndexOrder,
            IsActive = request.IsActive
        };
        await branches.AddAsync(branch, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(branch);
    }

    public async Task<Result<BranchDto>> UpdateAsync(Guid id, UpdateBranchRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<BranchDto>(validation.ToError("Branch.Validation"));

        var branch = await branches.GetByIdAsync(id, ct: ct);
        if (branch is null) return Result.Failure<BranchDto>(NotFoundError);

        var code = await ResolveCodeAsync(request.Code, request.Name, branch.Code, ct);
        if (code.IsFailure) return Result.Failure<BranchDto>(code.Error);

        branch.Code = code.Value;
        branch.Name = request.Name.Trim();
        branch.Address = request.Address?.Trim();
        branch.Phone = request.Phone?.Trim();
        branch.IndexOrder = request.IndexOrder;
        branch.IsActive = request.IsActive;
        branches.Update(branch);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(branch);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var branch = await branches.GetByIdAsync(id, ct: ct);
        if (branch is null) return Result.Failure(NotFoundError);

        if (await classes.AnyAsync(c => c.BranchId == id, ct))
            return Result.Failure(Error.Conflict("Branch.HasClasses", "Không thể xóa cơ sở khi vẫn còn lớp thuộc cơ sở này."));

        branches.SoftDelete(branch);
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
                if (!await branches.AnyAsync(b => b.Code == candidate, ct, includeDeleted: true))
                    return candidate;
            }
            return UniqueCodeGenerator.Next("BR");
        }
        var code = requested.Trim().ToUpperInvariant();
        if (currentCode != null && currentCode == code) return code;
        return await branches.AnyAsync(b => b.Code == code, ct, includeDeleted: true)
            ? Result.Failure<string>(Error.Conflict("Branch.DuplicateCode", $"Mã cơ sở '{requested}' đã tồn tại."))
            : (Result<string>)code;
    }

    private static BranchDto ToDto(Branch b) => new(
        b.Id, b.Code, b.Name, b.Address, b.Phone,
        b.IndexOrder, b.IsActive, b.IsDeleted, b.CreatedAt, b.UpdatedAt);
}
