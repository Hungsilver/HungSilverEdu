using AutoMapper;
using HungSilver.Application.Abstractions;
using HungSilver.Application.Common;
using HungSilver.Domain.Common.Results;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Journals;

public interface ITeacherJournalService
{
    Task<Result<TeacherJournalDto?>> GetBySessionAsync(Guid sessionId, CancellationToken ct = default);
    Task<Result<TeacherJournalDto>> UpsertAsync(Guid sessionId, UpsertJournalRequest request, CancellationToken ct = default);
}

public sealed class TeacherJournalService(
    IRepository<TeacherJournal> journals,
    IRepository<ClassSession> sessions,
    IClassAccessGuard accessGuard,
    IUnitOfWork unitOfWork,
    IMapper mapper) : ITeacherJournalService
{
    private static readonly Error SessionNotFound = Error.NotFound("Session.NotFound", "Không tìm thấy buổi học.");

    public async Task<Result<TeacherJournalDto?>> GetBySessionAsync(Guid sessionId, CancellationToken ct = default)
    {
        var session = await sessions.GetByIdAsync(sessionId, ct: ct);
        if (session is null)
            return Result.Failure<TeacherJournalDto?>(SessionNotFound);

        var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<TeacherJournalDto?>(access.Error);

        var existing = (await journals.FindAsync(j => j.ClassSessionId == sessionId, ct)).FirstOrDefault();
        return Result.Success<TeacherJournalDto?>(existing is null ? null : mapper.Map<TeacherJournalDto>(existing));
    }

    public async Task<Result<TeacherJournalDto>> UpsertAsync(Guid sessionId, UpsertJournalRequest request, CancellationToken ct = default)
    {
        var session = await sessions.GetByIdAsync(sessionId, ct: ct);
        if (session is null)
            return Result.Failure<TeacherJournalDto>(SessionNotFound);

        var access = await accessGuard.EnsureCanAccessClassAsync(session.ClassId, ct);
        if (access.IsFailure)
            return Result.Failure<TeacherJournalDto>(access.Error);

        var journal = (await journals.FindAsync(j => j.ClassSessionId == sessionId, ct)).FirstOrDefault();
        if (journal is null)
        {
            journal = new TeacherJournal
            {
                ClassSessionId = sessionId,
                ContentTaught = request.ContentTaught?.Trim(),
                Activities = request.Activities?.Trim(),
                Difficulties = request.Difficulties?.Trim(),
                NotesForNextSession = request.NotesForNextSession?.Trim()
            };
            await journals.AddAsync(journal, ct);
        }
        else
        {
            journal.ContentTaught = request.ContentTaught?.Trim();
            journal.Activities = request.Activities?.Trim();
            journal.Difficulties = request.Difficulties?.Trim();
            journal.NotesForNextSession = request.NotesForNextSession?.Trim();
            journals.Update(journal);
        }

        await unitOfWork.SaveChangesAsync(ct);
        return mapper.Map<TeacherJournalDto>(journal);
    }
}
