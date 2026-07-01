using HungSilver.Application.Exams;
using HungSilver.Domain.Common.Results;
using HungSilver.Infrastructure.Exams;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Xunit;

namespace HungSilver.UnitTests;

public sealed class ExamGenerationJobServiceTests
{
    [Fact]
    public async Task StartAsync_QueuesJob_AndWorkerStoresSuccessResult()
    {
        var services = new ServiceCollection();
        services.AddScoped<IExamGenerationService, FakeGenerationService>();
        await using var provider = services.BuildServiceProvider();

        var service = new ExamGenerationJobService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            new TestLogger<ExamGenerationJobService>());
        await ((IHostedService)service).StartAsync(CancellationToken.None);

        try
        {
            var userId = Guid.NewGuid();
            var start = await service.StartAsync(Guid.NewGuid(), Request(), userId);

            Assert.True(start.IsSuccess);
            Assert.Equal(ExamGenerationJobStatus.Queued, start.Value.Status);

            ExamGenerationJobDto? completed = null;
            for (var i = 0; i < 20; i++)
            {
                var status = service.Get(start.Value.JobId, userId);
                Assert.True(status.IsSuccess);
                if (status.Value.Status == ExamGenerationJobStatus.Succeeded)
                {
                    completed = status.Value;
                    break;
                }
                await Task.Delay(50);
            }

            Assert.NotNull(completed);
            Assert.Equal(FakeGenerationService.ExamId, completed!.Result!.ExamId);
            Assert.Equal(3, completed.Result.QuestionCount);
        }
        finally
        {
            await ((IHostedService)service).StopAsync(CancellationToken.None);
        }
    }

    private static GenerateExamRequest Request() =>
        new(ExamGenerationMode.Extract, "Đề nền", 45, null, null, null, Verify: false);

    private sealed class FakeGenerationService : IExamGenerationService
    {
        public static readonly Guid ExamId = Guid.NewGuid();

        public async Task<Result<ExamGenerationResult>> GenerateFromMaterialAsync(
            Guid materialId, GenerateExamRequest request, Guid userId, CancellationToken ct = default)
        {
            await Task.Delay(20, ct);
            return new ExamGenerationResult(ExamId, 3, 0, Array.Empty<string>());
        }
    }

    private sealed class TestLogger<T> : ILogger<T>
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => false;
        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter) { }
    }
}
