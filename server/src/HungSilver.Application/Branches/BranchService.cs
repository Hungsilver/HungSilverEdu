using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
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
        var list = await branches.FindAsync(
            b => includeInactive || b.IsActive,
            ct);

        return list.OrderBy(b => b.SortOrder).ThenBy(b => b.Name)
            .Select(ToDto)
            .ToList();
    }

    public async Task<Result<BranchDto>> CreateAsync(CreateBranchRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<BranchDto>(validation.ToError("Branch.Validation"));

        if (await branches.AnyAsync(b => b.Code == request.Code.Trim().ToUpper(), ct))
            return Result.Failure<BranchDto>(Error.Conflict("Branch.DuplicateCode", $"Mã cơ sở '{request.Code}' đã tồn tại."));

        var branch = new Branch
        {
            Code = request.Code.Trim().ToUpper(),
            Name = request.Name.Trim(),
            Address = request.Address?.Trim(),
            Phone = request.Phone?.Trim(),
            SortOrder = request.SortOrder,
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
        if (branch is null)
            return Result.Failure<BranchDto>(NotFoundError);

        var codeUpper = request.Code.Trim().ToUpper();
        if (branch.Code != codeUpper && await branches.AnyAsync(b => b.Code == codeUpper, ct))
            return Result.Failure<BranchDto>(Error.Conflict("Branch.DuplicateCode", $"Mã cơ sở '{request.Code}' đã tồn tại."));

        branch.Code = codeUpper;
        branch.Name = request.Name.Trim();
        branch.Address = request.Address?.Trim();
        branch.Phone = request.Phone?.Trim();
        branch.SortOrder = request.SortOrder;
        branch.IsActive = request.IsActive;

        branches.Update(branch);
        await unitOfWork.SaveChangesAsync(ct);

        return ToDto(branch);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var branch = await branches.GetByIdAsync(id, ct: ct);
        if (branch is null)
            return Result.Failure(NotFoundError);

        if (await classes.AnyAsync(c => c.BranchId == id, ct))
            return Result.Failure(Error.Conflict("Branch.HasClasses", "Không thể xóa cơ sở khi vẫn còn lớp thuộc cơ sở này."));

        branches.SoftDelete(branch);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static BranchDto ToDto(Branch b) => new(
        b.Id, b.Code, b.Name, b.Address, b.Phone,
        b.SortOrder, b.IsActive, b.IsDeleted, b.CreatedAt, b.UpdatedAt);
}
