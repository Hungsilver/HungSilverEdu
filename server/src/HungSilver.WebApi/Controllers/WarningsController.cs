using HungSilver.Application.Warnings;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/warnings")]
[Authorize(Policy = "TeacherOrAdmin")]
public class WarningsController(IWarningsService warningsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<WarningsDto>> Get([FromQuery] Guid? classId, [FromQuery] Guid? studentId, CancellationToken ct) =>
        (await warningsService.GetWarningsAsync(classId, studentId, ct)).ToActionResult();
}
