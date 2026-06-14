using HungSilver.Application.Journals;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/sessions/{sessionId:guid}/journal")]
[Authorize(Policy = "TeacherOrAdmin")]
public class TeacherJournalsController(ITeacherJournalService journalService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TeacherJournalDto?>> Get(Guid sessionId, CancellationToken ct) =>
        (await journalService.GetBySessionAsync(sessionId, ct)).ToActionResult();

    [HttpPut]
    public async Task<ActionResult<TeacherJournalDto>> Upsert(Guid sessionId, UpsertJournalRequest request, CancellationToken ct) =>
        (await journalService.UpsertAsync(sessionId, request, ct)).ToActionResult();
}
