using HungSilver.Application.Dashboard;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = "TeacherOrAdmin")]
public class DashboardController(IDashboardService dashboardService) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary(CancellationToken ct) =>
        (await dashboardService.GetSummaryAsync(ct)).ToActionResult();

    [HttpGet("charts")]
    public async Task<ActionResult<DashboardChartsDto>> GetCharts(CancellationToken ct) =>
        (await dashboardService.GetChartsAsync(ct)).ToActionResult();
}
