namespace HungSilver.Domain.Enums;

/// <summary>Nguồn tài liệu: link ngoài hay file trên server.</summary>
public enum MaterialSource
{
    ExternalUrl = 0,  // Lưu link/URL ngoài
    ServerFile = 1    // File upload trên server
}

/// <summary>Kiểu unit trong bộ tài liệu.</summary>
public enum MaterialUnitKind
{
    Unit = 0,    // Unit thường: "Unit {n}: {tên chủ đề}"
    Review = 1   // Thanh ôn tập xen kẽ: "Review {n}"
}
