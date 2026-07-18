using FluentValidation;
using HungSilver.Domain.Enums;

namespace HungSilver.Application.Materials;

public sealed class CreateMaterialRequestValidator : AbstractValidator<CreateMaterialRequest>
{
    public CreateMaterialRequestValidator()
    {
        // Tài liệu trong bộ (có FolderId): Môn/Khối snapshot từ bộ, Loại không bắt buộc.
        RuleFor(x => x.SubjectId).Must(id => id.HasValue && id != Guid.Empty)
            .When(x => x.FolderId is null || x.FolderId == Guid.Empty)
            .WithMessage("Chọn môn học cho tài liệu.");
        RuleFor(x => x.CategoryId).Must(id => id.HasValue && id != Guid.Empty)
            .When(x => x.FolderId is null || x.FolderId == Guid.Empty)
            .WithMessage("Chọn loại tài liệu.");
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Url).NotEmpty().MaximumLength(1000).When(x => x.Source == MaterialSource.ExternalUrl);
        RuleFor(x => x.StoredFileId).NotEmpty().When(x => x.Source == MaterialSource.ServerFile);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}

public sealed class UpdateMaterialRequestValidator : AbstractValidator<UpdateMaterialRequest>
{
    public UpdateMaterialRequestValidator()
    {
        RuleFor(x => x.SubjectId).Must(id => id.HasValue && id != Guid.Empty)
            .When(x => x.FolderId is null || x.FolderId == Guid.Empty)
            .WithMessage("Chọn môn học cho tài liệu.");
        RuleFor(x => x.CategoryId).Must(id => id.HasValue && id != Guid.Empty)
            .When(x => x.FolderId is null || x.FolderId == Guid.Empty)
            .WithMessage("Chọn loại tài liệu.");
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Url).NotEmpty().MaximumLength(1000).When(x => x.Source == MaterialSource.ExternalUrl);
        RuleFor(x => x.StoredFileId).NotEmpty().When(x => x.Source == MaterialSource.ServerFile);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}

// ----------------- Unit/Chương trong bộ (MaterialUnit) -----------------

public sealed class CreateMaterialUnitRequestValidator : AbstractValidator<CreateMaterialUnitRequest>
{
    public CreateMaterialUnitRequestValidator()
    {
        RuleFor(x => x.FolderId).Must(id => id != Guid.Empty).WithMessage("Thiếu bộ tài liệu chứa unit.");
        // Unit thường bắt buộc tên chủ đề; Review cho phép trống (hiển thị "Review 1").
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên chủ đề cho Unit.")
            .When(x => x.Kind == MaterialUnitKind.Unit);
        RuleFor(x => x.Name).MaximumLength(200);
    }
}

public sealed class UpdateMaterialUnitRequestValidator : AbstractValidator<UpdateMaterialUnitRequest>
{
    public UpdateMaterialUnitRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên chủ đề cho Unit.")
            .When(x => x.Kind == MaterialUnitKind.Unit);
        RuleFor(x => x.Name).MaximumLength(200);
    }
}

public sealed class ReorderMaterialUnitsRequestValidator : AbstractValidator<ReorderMaterialUnitsRequest>
{
    public ReorderMaterialUnitsRequestValidator()
    {
        RuleFor(x => x.FolderId).Must(id => id != Guid.Empty).WithMessage("Thiếu bộ tài liệu cần sắp xếp.");
        RuleFor(x => x.OrderedIds).NotEmpty().WithMessage("Danh sách sắp xếp trống.");
    }
}

// ----------------- Bộ tài liệu (MaterialFolder) -----------------

public sealed class CreateMaterialFolderRequestValidator : AbstractValidator<CreateMaterialFolderRequest>
{
    public CreateMaterialFolderRequestValidator()
    {
        RuleFor(x => x.SubjectId).Must(id => id != Guid.Empty).WithMessage("Chọn môn học cho bộ tài liệu.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên bộ tài liệu.").MaximumLength(200);
        RuleFor(x => x.GradeBand).MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}

public sealed class UpdateMaterialFolderRequestValidator : AbstractValidator<UpdateMaterialFolderRequest>
{
    public UpdateMaterialFolderRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên bộ tài liệu.").MaximumLength(200);
        RuleFor(x => x.GradeBand).MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(2000);
    }
}
