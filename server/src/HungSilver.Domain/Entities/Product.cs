using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>
/// Entity mẫu minh họa generic repository + soft delete + phân quyền CRUD.
/// </summary>
public class Product : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
}
