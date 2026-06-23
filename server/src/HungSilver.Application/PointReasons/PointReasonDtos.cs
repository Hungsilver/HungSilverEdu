using HungSilver.Domain.Enums;

namespace HungSilver.Application.PointReasons;

public sealed record PointReasonDto(
    Guid Id,
    string Label,
    int Points,
    PointReasonType Type,
    int IndexOrder,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record CreatePointReasonRequest(
    string Label,
    int Points,
    PointReasonType Type,
    int IndexOrder,
    bool IsActive = true);

public sealed record UpdatePointReasonRequest(
    string Label,
    int Points,
    PointReasonType Type,
    int IndexOrder,
    bool IsActive);
