using HungSilver.Application.Abstractions;
using HungSilver.Application.Materials;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HungSilver.Infrastructure.Materials;

/// <summary>
/// Học viên xem tài liệu được giao (guard theo Student.UserId + enrollment active — mirror ExamTakingService).
/// Đánh dấu "đã xem" lần đầu mở, idempotent.
/// </summary>
public sealed class PortalMaterialService(AppDbContext context, ICurrentUser currentUser) : IPortalMaterialService
{
    public async Task<Result<List<PortalMaterialDto>>> GetMyMaterialsAsync(CancellationToken ct = default)
    {
        var studentResult = await GetStudentAsync(ct);
        if (studentResult.IsFailure) return Result.Failure<List<PortalMaterialDto>>(studentResult.Error);
        var student = studentResult.Value;

        var classIds = await StudentClassIdsAsync(student.Id, ct);
        if (classIds.Count == 0) return new List<PortalMaterialDto>();

        var assignments = await context.MaterialAssignments.AsNoTracking()
            .Where(a => classIds.Contains(a.ClassId))
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct);
        if (assignments.Count == 0) return new List<PortalMaterialDto>();

        // Resolve tài liệu LIVE — tài liệu đã xóa mềm khỏi Kho thì ẩn luôn khỏi portal (không còn gì để mở).
        var materialIds = assignments.Select(a => a.MaterialId).Distinct().ToList();
        var materials = await context.LearningMaterials.AsNoTracking()
            .Where(m => materialIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var fileIds = materials.Values.Where(m => m.StoredFileId is not null).Select(m => m.StoredFileId!.Value).Distinct().ToList();
        var fileNames = await context.StoredFiles.AsNoTracking()
            .Where(f => fileIds.Contains(f.Id))
            .ToDictionaryAsync(f => f.Id, f => f.FileName, ct);

        var cIds = assignments.Select(a => a.ClassId).Distinct().ToList();
        var classNames = await context.Classes.Where(c => cIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        var assignmentIds = assignments.Select(a => a.Id).ToList();
        var viewedIds = (await context.MaterialAssignmentViews.AsNoTracking()
                .Where(v => v.StudentId == student.Id && assignmentIds.Contains(v.MaterialAssignmentId))
                .Select(v => v.MaterialAssignmentId)
                .ToListAsync(ct))
            .ToHashSet();

        return assignments
            .Where(a => materials.ContainsKey(a.MaterialId))
            .Select(a =>
            {
                var m = materials[a.MaterialId];
                return new PortalMaterialDto(
                    a.Id, a.MaterialId, m.Title,
                    classNames.GetValueOrDefault(a.ClassId, ""),
                    a.Note, m.Source, m.Url, m.StoredFileId,
                    m.StoredFileId is Guid fid ? fileNames.GetValueOrDefault(fid) : null,
                    viewedIds.Contains(a.Id), a.CreatedAt);
            })
            .ToList();
    }

    public async Task<Result> MarkViewedAsync(Guid assignmentId, CancellationToken ct = default)
    {
        var studentResult = await GetStudentAsync(ct);
        if (studentResult.IsFailure) return Result.Failure(studentResult.Error);
        var student = studentResult.Value;

        var assignment = await context.MaterialAssignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == assignmentId, ct);
        if (assignment is null) return Result.Failure(Error.NotFound("Material.AssignmentNotFound", "Không tìm thấy tài liệu được giao."));

        var classIds = await StudentClassIdsAsync(student.Id, ct);
        if (!classIds.Contains(assignment.ClassId))
            return Result.Failure(Error.Forbidden("Material.NotInClass", "Bạn không thuộc lớp được giao tài liệu này."));

        var existed = await context.MaterialAssignmentViews.AsNoTracking()
            .AnyAsync(v => v.MaterialAssignmentId == assignmentId && v.StudentId == student.Id, ct);
        if (existed) return Result.Success(); // idempotent — chỉ ghi lần đầu

        context.MaterialAssignmentViews.Add(new MaterialAssignmentView
        {
            MaterialAssignmentId = assignmentId,
            StudentId = student.Id,
            ViewedAt = DateTime.Now
        });
        try
        {
            await context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Đua 2 tab cùng đánh dấu — bản ghi đã có, coi như thành công.
        }
        return Result.Success();
    }

    private async Task<Result<Student>> GetStudentAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId;
        if (userId is null) return Result.Failure<Student>(Error.Unauthorized("Portal.Unauthorized", "Chưa đăng nhập."));
        var student = await context.Students.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        return student is null
            ? Result.Failure<Student>(Error.NotFound("Portal.NotLinked", "Tài khoản chưa liên kết hồ sơ học sinh."))
            : student;
    }

    private async Task<List<Guid>> StudentClassIdsAsync(Guid studentId, CancellationToken ct) =>
        await context.Enrollments.AsNoTracking()
            .Where(e => e.StudentId == studentId && e.IsActive)
            .Select(e => e.ClassId).Distinct().ToListAsync(ct);
}
