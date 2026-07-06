using HungSilver.Domain.Enums;
using HungSilver.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HungSilver.Infrastructure.Exams;

/// <summary>
/// Dịch vụ nền chốt các lượt làm bài BỎ DỞ: tự-nộp chỉ chạy ở client nên HS đóng tab/mất mạng/hết pin
/// là attempt kẹt InProgress vĩnh viễn — không được chấm, báo cáo GV mãi "Đang làm". Mỗi 2 phút quét
/// attempt InProgress đã quá hạn giờ làm (StartedAt + DurationMinutes + grace) → tự chấm phần đã lưu
/// (AutoSubmitted) bằng đúng lõi chấm của luồng nộp bài.
/// Chủ đích KHÔNG chốt sớm khi GV đóng lượt giao/quá CloseAt: HS đang làm dở vẫn được dùng hết thời
/// gian của mình (nhất quán SaveAnswer/Submit chỉ chặn theo giờ làm) — hết giờ thì service này chốt.
/// </summary>
public sealed class ExamAttemptFinalizeService(
    IServiceScopeFactory scopeFactory,
    ILogger<ExamAttemptFinalizeService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var finalized = await FinalizeExpiredCoreAsync(db, DateTime.Now, stoppingToken);
                if (finalized > 0)
                    logger.LogInformation("Chốt {Count} lượt làm bài bỏ dở đã quá hạn (tự chấm AutoSubmitted).", finalized);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lỗi khi chốt lượt làm bài quá hạn.");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }

    /// <summary>
    /// Lõi tách riêng để test: chấm + chốt mọi attempt InProgress đã quá hạn giờ làm tại thời điểm
    /// <paramref name="now"/>. Attempt mồ côi (lượt giao đã xóa mềm) bỏ qua — không còn ngữ cảnh chấm.
    /// Trả về số attempt đã chốt.
    /// </summary>
    public static async Task<int> FinalizeExpiredCoreAsync(AppDbContext db, DateTime now, CancellationToken ct = default)
    {
        var inProgress = await db.ExamAttempts
            .Where(t => t.Status == ExamAttemptStatus.InProgress)
            .ToListAsync(ct);
        if (inProgress.Count == 0) return 0;

        var assignmentIds = inProgress.Select(t => t.ExamAssignmentId).Distinct().ToList();
        var assignments = await db.ExamAssignments
            .Where(a => assignmentIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, ct);

        var finalized = 0;
        foreach (var attempt in inProgress)
        {
            if (!assignments.TryGetValue(attempt.ExamAssignmentId, out var assignment))
                continue;

            var expiresAt = (attempt.StartedAt ?? attempt.CreatedAt).AddMinutes(assignment.DurationMinutes);
            if (now <= expiresAt.AddSeconds(ExamTakingService.GraceSeconds)) continue;

            await ExamTakingService.GradeAndFinalizeAsync(db, attempt, assignment, ExamAttemptStatus.AutoSubmitted, ct);
            finalized++;
        }

        if (finalized > 0) await db.SaveChangesAsync(ct);
        return finalized;
    }
}
