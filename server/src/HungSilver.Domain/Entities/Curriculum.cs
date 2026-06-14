using HungSilver.Domain.Common;

namespace HungSilver.Domain.Entities;

/// <summary>Giáo trình (Module 2, 4).</summary>
public class Curriculum : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Level { get; set; }
    public string? Description { get; set; }
}
