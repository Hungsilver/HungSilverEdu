using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Application.Materials;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Materials;

/// <summary>
/// GV giao tài liệu trong Kho cho lớp (mirror ExamAssignmentService): access-guard lớp, validate buổi cùng lớp,
/// chặn giao trùng. Theo dõi "đã xem" per-student qua MaterialAssignmentView.
/// </summary>
public sealed class MaterialAssignmentService(
    AppDbContext context,
    IClassAccessGuard accessGuard,
    ICurrentUser currentUser) : IMaterialAssignmentService
{
    public async Task<Result<MaterialAssignmentDto>> AssignAsync(Guid materialId, AssignMaterialRequest request, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(request.ClassId, ct);
        if (access.IsFailure) return Result.Failure<MaterialAssignmentDto>(access.Error);

        var material = await context.LearningMaterials.AsNoTracking().FirstOrDefaultAsync(m => m.Id == materialId, ct);
        if (material is null)
            return Result.Failure<MaterialAssignmentDto>(Error.NotFound("Material.NotFound", "Không tìm thấy tài liệu."));

        if (request.ClassSessionId is not null)
        {
            var session = await context.ClassSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == request.ClassSessionId, ct);
            if (session is null || session.ClassId != request.ClassId)
                return Result.Failure<MaterialAssignmentDto>(Error.Validation("Material.SessionClassMismatch", "Buổi học không thuộc lớp đã chọn."));
        }

        var note = request.Note?.Trim();
        if (note is { Length: > 1000 })
            return Result.Failure<MaterialAssignmentDto>(Error.Validation("Material.NoteTooLong", "Ghi chú tối đa 1000 ký tự."));

        // Tài liệu không có vòng đời Mở/Đóng như đề — mỗi cặp (tài liệu, lớp) chỉ 1 lượt giao đang hiệu lực.
        var duplicated = await context.MaterialAssignments.AnyAsync(
            a => a.MaterialId == materialId && a.ClassId == request.ClassId, ct);
        if (duplicated)
            return Result.Failure<MaterialAssignmentDto>(Error.Conflict("Material.AlreadyAssigned",
                "Tài liệu này đã được giao cho lớp — thu hồi lượt cũ trước khi giao lại."));

        var assignment = new MaterialAssignment
        {
            MaterialId = material.Id,
            MaterialTitle = material.Title,
            ClassId = request.ClassId,
            ClassSessionId = request.ClassSessionId,
            Note = string.IsNullOrEmpty(note) ? null : note,
            AssignedByUserId = currentUser.UserId
        };
        context.MaterialAssignments.Add(assignment);
        await context.SaveChangesAsync(ct);

        return (await ToDtosAsync([assignment], ct))[0];
    }

    public async Task<Result<List<MaterialAssignmentDto>>> ListByClassAsync(Guid classId, CancellationToken ct = default)
    {
        var access = await accessGuard.EnsureCanAccessClassAsync(classId, ct);
        if (access.IsFailure) return Result.Failure<List<MaterialAssignmentDto>>(access.Error);

        var assignments = await context.MaterialAssignments.AsNoTracking()
            .Where(a => a.ClassId == classId).OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        return await ToDtosAsync(assignments, ct);
    }

    public async Task<Result<List<MaterialAssignmentDto>>> ListBySessionAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await context.ClassSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null) return Result.Failure<List<MaterialAssignmentDto>>(Error.NotFound("Session.NotFound", "Không tìm thấy buổi học."));

        var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
        if (access.IsFailure) return Result.Failure<List<MaterialAssignmentDto>>(access.Error);

        // Chỉ lượt giao gắn đúng buổi này — tài liệu giao cho lớp không gắn buổi xem ở trang chi tiết lớp.
        var assignments = await context.MaterialAssignments.AsNoTracking()
            .Where(a => a.ClassSessionId == sessionId).OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        return await ToDtosAsync(assignments, ct);
    }

    public async Task<Result> RemoveAsync(Guid assignmentId, CancellationToken ct = default)
    {
        var assignment = await context.MaterialAssignments.FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment is null) return Result.Failure(Error.NotFound("Material.AssignmentNotFound", "Không tìm thấy lượt giao tài liệu."));

        var access = await accessGuard.EnsureCanAccessClassAsync(assignment.ClassId, ct);
        if (access.IsFailure) return access;

        // Thu hồi = xóa mềm lượt giao; GIỮ bản ghi đã-xem (lịch sử) — giao lại sẽ tạo lượt mới, đếm lại từ đầu.
        context.MaterialAssignments.Remove(assignment);
        await context.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task<Result<List<MaterialAssignmentViewerDto>>> GetViewersAsync(Guid assignmentId, CancellationToken ct = default)
    {
        var assignment = await context.MaterialAssignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment is null) return Result.Failure<List<MaterialAssignmentViewerDto>>(Error.NotFound("Material.AssignmentNotFound", "Không tìm thấy lượt giao tài liệu."));

        var access = await accessGuard.EnsureCanAccessClassAsync(assignment.ClassId, ct);
        if (access.IsFailure) return Result.Failure<List<MaterialAssignmentViewerDto>>(access.Error);

        var activeStudents = await (from e in context.Enrollments.AsNoTracking()
                                    join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
                                    where e.ClassId == assignment.ClassId && e.IsActive
                                    select new { s.Id, s.FullName })
            .Distinct().ToListAsync(ct);

        var views = await context.MaterialAssignmentViews.AsNoTracking()
            .Where(v => v.MaterialAssignmentId == assignmentId)
            .ToDictionaryAsync(v => v.StudentId, v => v.ViewedAt, ct);

        // HS đã rời lớp nhưng từng xem: vẫn hiện (IsActive=false) để GV thấy đủ lịch sử — mirror ExamReportService.
        var activeIds = activeStudents.Select(s => s.Id).ToHashSet();
        var formerIds = views.Keys.Where(id => !activeIds.Contains(id)).ToList();
        var formerStudents = await context.Students.AsNoTracking()
            .Where(s => formerIds.Contains(s.Id))
            .Select(s => new { s.Id, s.FullName })
            .ToListAsync(ct);

        return activeStudents.Select(s => (s.Id, s.FullName, IsActive: true))
            .Concat(formerStudents.Select(s => (s.Id, s.FullName, IsActive: false)))
            .Select(s => new MaterialAssignmentViewerDto(s.Id, s.FullName,
                views.TryGetValue(s.Id, out var at) ? at : null, s.IsActive))
            .OrderBy(v => v.FullName)
            .ToList();
    }

    /// <summary>
    /// Dựng DTO kèm tên lớp + sĩ số + số đã xem (dùng chung Assign/ListByClass/ListBySession).
    /// Tên/nguồn tài liệu resolve LIVE; tài liệu đã xóa mềm ⇒ MaterialDeleted=true + fallback snapshot title.
    /// "Đã xem x/y" chỉ đếm học viên ĐANG học trong lớp để tỷ lệ có nghĩa với GV.
    /// </summary>
    private async Task<List<MaterialAssignmentDto>> ToDtosAsync(List<MaterialAssignment> assignments, CancellationToken ct)
    {
        if (assignments.Count == 0) return [];

        var classIds = assignments.Select(a => a.ClassId).Distinct().ToList();
        var classNames = await context.Classes.Where(c => classIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        // 1 query lấy cả sĩ số lẫn tập HS active per-class (join Students để loại HS đã xóa mềm).
        var activeByClass = (await (from e in context.Enrollments.AsNoTracking()
                                    join s in context.Students.AsNoTracking() on e.StudentId equals s.Id
                                    where classIds.Contains(e.ClassId) && e.IsActive
                                    select new { e.ClassId, e.StudentId })
                .Distinct().ToListAsync(ct))
            .GroupBy(x => x.ClassId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.StudentId).ToHashSet());

        var assignmentIds = assignments.Select(a => a.Id).ToList();
        var views = await context.MaterialAssignmentViews.AsNoTracking()
            .Where(v => assignmentIds.Contains(v.MaterialAssignmentId))
            .Select(v => new { v.MaterialAssignmentId, v.StudentId })
            .ToListAsync(ct);
        var viewsByAssignment = views.GroupBy(v => v.MaterialAssignmentId)
            .ToDictionary(g => g.Key, g => g.Select(v => v.StudentId).ToList());

        var materialIds = assignments.Select(a => a.MaterialId).Distinct().ToList();
        var materials = await context.LearningMaterials.AsNoTracking()
            .Where(m => materialIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var fileIds = materials.Values.Where(m => m.StoredFileId is not null).Select(m => m.StoredFileId!.Value).Distinct().ToList();
        var fileNames = await context.StoredFiles.AsNoTracking()
            .Where(f => fileIds.Contains(f.Id))
            .ToDictionaryAsync(f => f.Id, f => f.FileName, ct);

        return assignments.Select(a =>
        {
            var activeSet = activeByClass.GetValueOrDefault(a.ClassId);
            var viewed = viewsByAssignment.TryGetValue(a.Id, out var studentIds) && activeSet is not null
                ? studentIds.Count(activeSet.Contains)
                : 0;
            materials.TryGetValue(a.MaterialId, out var m);
            return new MaterialAssignmentDto(
                a.Id, a.MaterialId,
                m?.Title ?? a.MaterialTitle ?? "Tài liệu",
                MaterialDeleted: m is null,
                a.ClassId, classNames.GetValueOrDefault(a.ClassId, ""),
                a.ClassSessionId, a.Note,
                m?.Source ?? MaterialSource.ExternalUrl,
                m?.Url,
                m?.StoredFileId,
                m?.StoredFileId is Guid fid ? fileNames.GetValueOrDefault(fid) : null,
                viewed, activeSet?.Count ?? 0, a.CreatedAt);
        }).ToList();
    }
}
