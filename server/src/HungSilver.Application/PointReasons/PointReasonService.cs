using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.PointReasons;

public interface IPointReasonService
{
    Task<Result<List<PointReasonDto>>> GetAllAsync(PointReasonType? type = null, bool includeInactive = false, CancellationToken ct = default);
    Task<Result<PointReasonDto>> CreateAsync(CreatePointReasonRequest request, CancellationToken ct = default);
    Task<Result<PointReasonDto>> UpdateAsync(Guid id, UpdatePointReasonRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class PointReasonService(
    IRepository<PointReason> reasons,
    IUnitOfWork unitOfWork,
    IValidator<CreatePointReasonRequest> createValidator,
    IValidator<UpdatePointReasonRequest> updateValidator) : IPointReasonService
{
    private static readonly Error NotFoundError = Error.NotFound("PointReason.NotFound", "Không tìm thấy lý do điểm.");

    public async Task<Result<List<PointReasonDto>>> GetAllAsync(PointReasonType? type = null, bool includeInactive = false, CancellationToken ct = default)
    {
        var items = await reasons.FindAsync(
            r => (includeInactive || r.IsActive) && (type == null || r.Type == type), ct);
        return items.OrderBy(r => r.Type).ThenBy(r => r.IndexOrder).ThenBy(r => r.Label).Select(ToDto).ToList();
    }

    public async Task<Result<PointReasonDto>> CreateAsync(CreatePointReasonRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<PointReasonDto>(validation.ToError("PointReason.Validation"));

        var reason = new PointReason
        {
            Label = request.Label.Trim(),
            Points = request.Points,
            Type = request.Type,
            IndexOrder = request.IndexOrder,
            IsActive = request.IsActive
        };
        await reasons.AddAsync(reason, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(reason);
    }

    public async Task<Result<PointReasonDto>> UpdateAsync(Guid id, UpdatePointReasonRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<PointReasonDto>(validation.ToError("PointReason.Validation"));

        var reason = await reasons.GetByIdAsync(id, ct: ct);
        if (reason is null)
            return Result.Failure<PointReasonDto>(NotFoundError);

        reason.Label = request.Label.Trim();
        reason.Points = request.Points;
        reason.Type = request.Type;
        reason.IndexOrder = request.IndexOrder;
        reason.IsActive = request.IsActive;
        reasons.Update(reason);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(reason);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var reason = await reasons.GetByIdAsync(id, ct: ct);
        if (reason is null) return Result.Failure(NotFoundError);

        reasons.SoftDelete(reason);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static PointReasonDto ToDto(PointReason r) =>
        new(r.Id, r.Label, r.Points, r.Type, r.IndexOrder, r.IsActive, r.CreatedAt, r.UpdatedAt);
}
