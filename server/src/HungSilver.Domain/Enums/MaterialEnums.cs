namespace HungSilver.Domain.Enums;

/// <summary>Loại tài liệu học tập.</summary>
public enum MaterialType
{
    Pdf = 0,
    Video = 1,
    Vocabulary = 2,  // Từ vựng
    Test = 3,        // Đề kiểm tra
    Homework = 4     // Bài tập về nhà
}

/// <summary>Nguồn tài liệu: link ngoài hay file trên server.</summary>
public enum MaterialSource
{
    ExternalUrl = 0,  // Lưu link/URL ngoài
    ServerFile = 1    // File upload trên server
}
