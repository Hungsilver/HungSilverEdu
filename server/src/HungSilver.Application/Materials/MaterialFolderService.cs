using FluentValidation;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Materials;

public interface IMaterialFolderService
{
    /// <summary>Mức 1 "Tài liệu môn học": danh sách môn kèm số bộ + số tài liệu.</summary>
    Task<Result<List<MaterialSubjectSummaryDto>>> GetSubjectsSummaryAsync(CancellationToken ct = default);
    Task<Result<List<MaterialFolderDto>>> GetBySubjectAsync(Guid subjectId, CancellationToken ct = default);
    Task<Result<MaterialFolderDto>> CreateAsync(CreateMaterialFolderRequest request, CancellationToken ct = default);
    Task<Result<MaterialFolderDto>> UpdateAsync(Guid id, UpdateMaterialFolderRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// Bộ tài liệu (vd "Tiếng Anh 10") — gom tài liệu theo Môn. Môn của bộ BẤT BIẾN sau khi tạo;
/// đổi Khối của bộ sẽ đồng bộ Khối cho tài liệu bên trong; xóa bộ bị chặn khi còn tài liệu.
/// </summary>
public sealed class MaterialFolderService(
    IRepository<MaterialFolder> folders,
    IRepository<LearningMaterial> materials,
    IRepository<Subject> subjects,
    IRepository<StoredFile> storedFiles,
    IUnitOfWork unitOfWork,
    IValidator<CreateMaterialFolderRequest> createValidator,
    IValidator<UpdateMaterialFolderRequest> updateValidator) : IMaterialFolderService
{
    private static readonly Error NotFoundError = Error.NotFound("MaterialFolder.NotFound", "Không tìm thấy bộ tài liệu.");

    public async Task<Result<List<MaterialSubjectSummaryDto>>> GetSubjectsSummaryAsync(CancellationToken ct = default)
    {
        var activeSubjects = (await subjects.FindAsync(s => s.IsActive, ct)).OrderBy(s => s.IndexOrder).ThenBy(s => s.Name).ToList();
        var allFolders = await folders.FindAsync(_ => true, ct);
        var folderCountBySubject = allFolders.GroupBy(f => f.SubjectId).ToDictionary(g => g.Key, g => g.Count());
        var materialCountByFolder = await CountMaterialsByFolderAsync(allFolders.Select(f => f.Id).ToList(), ct);
        var materialCountBySubject = allFolders
            .GroupBy(f => f.SubjectId)
            .ToDictionary(g => g.Key, g => g.Sum(f => materialCountByFolder.GetValueOrDefault(f.Id)));

        // Môn active trước (kể cả 0 bộ — GV cần thấy môn để tạo bộ đầu tiên), sau đó append môn chỉ còn
        // trong snapshot của bộ (môn đã xóa/ngừng dùng nhưng còn bộ — tránh bộ "mồ côi vô hình").
        var result = activeSubjects
            .Select(s => new MaterialSubjectSummaryDto(s.Id, s.Name,
                folderCountBySubject.GetValueOrDefault(s.Id), materialCountBySubject.GetValueOrDefault(s.Id)))
            .ToList();
        var known = activeSubjects.Select(s => s.Id).ToHashSet();
        result.AddRange(allFolders
            .Where(f => !known.Contains(f.SubjectId))
            .GroupBy(f => f.SubjectId)
            .Select(g => new MaterialSubjectSummaryDto(g.Key, g.First().SubjectName,
                g.Count(), g.Sum(f => materialCountByFolder.GetValueOrDefault(f.Id)))));

        return result;
    }

    public async Task<Result<List<MaterialFolderDto>>> GetBySubjectAsync(Guid subjectId, CancellationToken ct = default)
    {
        var list = (await folders.FindAsync(f => f.SubjectId == subjectId, ct))
            .OrderBy(f => f.Name, StringComparer.CurrentCulture).ToList();
        var counts = await CountMaterialsByFolderAsync(list.Select(f => f.Id).ToList(), ct);
        return list.Select(f => ToDto(f, counts.GetValueOrDefault(f.Id))).ToList();
    }

    public async Task<Result<MaterialFolderDto>> CreateAsync(CreateMaterialFolderRequest request, CancellationToken ct = default)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialFolderDto>(validation.ToError("MaterialFolder.Validation"));

        var subject = await subjects.GetByIdAsync(request.SubjectId, ct: ct);
        if (subject is null)
            return Result.Failure<MaterialFolderDto>(Error.Validation("MaterialFolder.SubjectNotFound", "Không tìm thấy môn học."));

        var cover = await CoverFileResolver.ResolveAsync(storedFiles, request.CoverFileId, ct);
        if (cover.IsFailure)
            return Result.Failure<MaterialFolderDto>(cover.Error);

        var folder = new MaterialFolder
        {
            SubjectId = subject.Id,
            SubjectName = subject.Name,
            Name = request.Name.Trim(),
            GradeBand = CleanBand(request.GradeBand),
            CoverFileId = cover.Value,
            Description = request.Description?.Trim()
        };

        await folders.AddAsync(folder, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(folder, 0);
    }

    public async Task<Result<MaterialFolderDto>> UpdateAsync(Guid id, UpdateMaterialFolderRequest request, CancellationToken ct = default)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Result.Failure<MaterialFolderDto>(validation.ToError("MaterialFolder.Validation"));

        var folder = await folders.GetByIdAsync(id, ct: ct);
        if (folder is null)
            return Result.Failure<MaterialFolderDto>(NotFoundError);

        var cover = await CoverFileResolver.ResolveAsync(storedFiles, request.CoverFileId, ct);
        if (cover.IsFailure)
            return Result.Failure<MaterialFolderDto>(cover.Error);

        var newBand = CleanBand(request.GradeBand);
        var bandChanged = !string.Equals(folder.GradeBand, newBand, StringComparison.Ordinal);

        folder.Name = request.Name.Trim();
        folder.GradeBand = newBand;
        folder.CoverFileId = cover.Value; // đổi/xóa ảnh KHÔNG xóa file cũ — orphan để FileCleanupService dọn
        folder.Description = request.Description?.Trim();
        // SubjectId/SubjectName BẤT BIẾN — không nhận từ request.
        folders.Update(folder);

        // Đồng bộ Khối cho tài liệu trong bộ (tài liệu kế thừa Khối từ bộ — giữ filter Khối ở Ngân hàng câu hỏi đúng).
        var children = await materials.FindAsync(m => m.FolderId == id, ct);
        if (bandChanged)
        {
            foreach (var m in children)
            {
                m.GradeBand = newBand;
                materials.Update(m);
            }
        }

        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(folder, children.Count);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var folder = await folders.GetByIdAsync(id, ct: ct);
        if (folder is null)
            return Result.Failure(NotFoundError);

        if (await materials.AnyAsync(m => m.FolderId == id, ct))
            return Result.Failure(Error.Conflict("MaterialFolder.InUse",
                "Bộ tài liệu vẫn còn tài liệu bên trong — hãy xóa hoặc chuyển hết tài liệu trước."));

        folders.SoftDelete(folder); // ảnh bìa (nếu có) thành orphan — FileCleanupService tự dọn
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<Dictionary<Guid, int>> CountMaterialsByFolderAsync(List<Guid> folderIds, CancellationToken ct)
    {
        if (folderIds.Count == 0) return [];
        var items = await materials.FindAsync(m => m.FolderId != null && folderIds.Contains(m.FolderId.Value), ct);
        return items.GroupBy(m => m.FolderId!.Value).ToDictionary(g => g.Key, g => g.Count());
    }

    private static string? CleanBand(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static MaterialFolderDto ToDto(MaterialFolder f, int materialCount) =>
        new(f.Id, f.SubjectId, f.SubjectName, f.Name, f.GradeBand, f.CoverFileId, f.Description, materialCount, f.CreatedAt);
}
