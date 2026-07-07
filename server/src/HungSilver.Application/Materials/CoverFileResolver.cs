using HungSilver.Application.Abstractions;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Materials;

/// <summary>Kiểm tra ảnh bìa (nếu có): StoredFile tồn tại và là ảnh. Dùng chung cho tài liệu + bộ tài liệu.</summary>
internal static class CoverFileResolver
{
    private static readonly Error CoverNotFound = Error.Validation("Materials.CoverNotFound", "Không tìm thấy ảnh bìa đã tải lên — hãy tải lại ảnh.");
    private static readonly Error CoverNotImage = Error.Validation("Materials.CoverNotImage", "Ảnh bìa phải là file ảnh.");

    /// <summary>Trả về id đã chuẩn hóa (Guid.Empty → null); lỗi nghiệp vụ nếu file không tồn tại/không phải ảnh.</summary>
    public static async Task<Result<Guid?>> ResolveAsync(IRepository<StoredFile> storedFiles, Guid? coverFileId, CancellationToken ct)
    {
        var cover = coverFileId is null || coverFileId == Guid.Empty ? null : coverFileId;
        if (cover is null) return Result.Success<Guid?>(null);
        var file = await storedFiles.GetByIdAsync(cover.Value, ct: ct);
        if (file is null) return Result.Failure<Guid?>(CoverNotFound);
        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<Guid?>(CoverNotImage);
        return Result.Success<Guid?>(cover);
    }
}
