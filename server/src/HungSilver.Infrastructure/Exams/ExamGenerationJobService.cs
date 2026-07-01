using System.Collections.Concurrent;
using System.Threading.Channels;
using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HungSilver.Infrastructure.Exams;

/// <summary>
/// Queue in-memory cho sinh đề AI. Request HTTP chỉ tạo job nhanh; worker nền xử lý tuần tự để tránh timeout proxy.
/// Job không bền qua restart app; nếu cần SLA cao hơn thì nâng cấp thành bảng DB/queue ngoài.
/// </summary>
public sealed class ExamGenerationJobService(
    IServiceScopeFactory scopeFactory,
    ILogger<ExamGenerationJobService> logger) : BackgroundService, IExamGenerationJobService
{
    private const int PollAfterSeconds = 2;
    private static readonly TimeSpan Retention = TimeSpan.FromHours(2);
    private readonly Channel<Guid> queue = Channel.CreateUnbounded<Guid>();
    private readonly ConcurrentDictionary<Guid, JobState> jobs = new();

    public async Task<Result<ExamGenerationJobStartResult>> StartAsync(
        Guid materialId, GenerateExamRequest request, Guid userId, CancellationToken ct = default)
    {
        CleanupOldJobs();

        var job = new JobState
        {
            JobId = Guid.NewGuid(),
            MaterialId = materialId,
            Request = request,
            UserId = userId,
            CreatedAt = DateTime.Now,
            Status = ExamGenerationJobStatus.Queued
        };

        jobs[job.JobId] = job;
        await queue.Writer.WriteAsync(job.JobId, ct);
        return new ExamGenerationJobStartResult(job.JobId, job.Status, job.CreatedAt, PollAfterSeconds);
    }

    public Result<ExamGenerationJobDto> Get(Guid jobId, Guid userId)
    {
        if (!jobs.TryGetValue(jobId, out var job) || job.UserId != userId)
            return Result.Failure<ExamGenerationJobDto>(Error.NotFound("ExamGenerationJob.NotFound", "Không tìm thấy job sinh đề."));

        lock (job)
        {
            return ToDto(job);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var jobId in queue.Reader.ReadAllAsync(stoppingToken))
        {
            if (!jobs.TryGetValue(jobId, out var job))
                continue;

            await RunJobAsync(job, stoppingToken);
            CleanupOldJobs();
        }
    }

    private async Task RunJobAsync(JobState job, CancellationToken stoppingToken)
    {
        lock (job)
        {
            job.Status = ExamGenerationJobStatus.Running;
            job.StartedAt = DateTime.Now;
        }

        try
        {
            using var scope = scopeFactory.CreateScope();
            var generation = scope.ServiceProvider.GetRequiredService<IExamGenerationService>();
            var result = await generation.GenerateFromMaterialAsync(job.MaterialId, job.Request, job.UserId, stoppingToken);

            lock (job)
            {
                job.CompletedAt = DateTime.Now;
                if (result.IsSuccess)
                {
                    job.Status = ExamGenerationJobStatus.Succeeded;
                    job.Result = result.Value;
                }
                else
                {
                    job.Status = ExamGenerationJobStatus.Failed;
                    job.ErrorCode = result.Error.Code;
                    job.ErrorMessage = result.Error.Message;
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            lock (job)
            {
                job.Status = ExamGenerationJobStatus.Failed;
                job.CompletedAt = DateTime.Now;
                job.ErrorCode = "ExamGenerationJob.Cancelled";
                job.ErrorMessage = "Tiến trình sinh đề đã bị hủy do server dừng.";
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lỗi không mong muốn khi sinh đề AI. JobId={JobId}", job.JobId);
            lock (job)
            {
                job.Status = ExamGenerationJobStatus.Failed;
                job.CompletedAt = DateTime.Now;
                job.ErrorCode = "ExamGenerationJob.Failed";
                job.ErrorMessage = "Sinh đề thất bại. Vui lòng thử lại sau.";
            }
        }
    }

    private void CleanupOldJobs()
    {
        var cutoff = DateTime.Now - Retention;
        foreach (var (id, job) in jobs)
        {
            if (job.CompletedAt is not null && job.CompletedAt < cutoff)
                jobs.TryRemove(id, out _);
        }
    }

    private static ExamGenerationJobDto ToDto(JobState job) =>
        new(job.JobId, job.Status, job.CreatedAt, job.StartedAt, job.CompletedAt,
            job.Result, job.ErrorCode, job.ErrorMessage, PollAfterSeconds);

    private sealed class JobState
    {
        public Guid JobId { get; init; }
        public Guid MaterialId { get; init; }
        public required GenerateExamRequest Request { get; init; }
        public Guid UserId { get; init; }
        public DateTime CreatedAt { get; init; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public ExamGenerationJobStatus Status { get; set; }
        public ExamGenerationResult? Result { get; set; }
        public string? ErrorCode { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
