namespace HungSilver.Application.Journals;

public sealed record TeacherJournalDto(
    Guid Id,
    Guid ClassSessionId,
    string? ContentTaught,
    string? Activities,
    string? Difficulties,
    string? NotesForNextSession,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);

public sealed record UpsertJournalRequest(
    string? ContentTaught,
    string? Activities,
    string? Difficulties,
    string? NotesForNextSession);
