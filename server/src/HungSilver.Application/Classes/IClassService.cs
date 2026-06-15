using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Classes;

public interface IClassService
{
    Task<Result<PagedResult<ClassListItemDto>>> GetPagedAsync(PagedRequest request, bool includeDeleted = false, CancellationToken ct = default);
    Task<Result<ClassDto>> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<ClassDto>> CreateAsync(CreateClassRequest request, CancellationToken ct = default);
    Task<Result<ClassDto>> UpdateAsync(Guid id, UpdateClassRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<Result> RestoreAsync(Guid id, CancellationToken ct = default);
    Task<Result> AssignTeacherAsync(Guid classId, AssignTeacherRequest request, CancellationToken ct = default);
    Task<Result<List<RosterItemDto>>> GetRosterAsync(Guid classId, CancellationToken ct = default);
    Task<Result<List<ClassStudentOverviewDto>>> GetOverviewAsync(Guid classId, CancellationToken ct = default);
    Task<Result> EnrollAsync(Guid classId, EnrollStudentRequest request, CancellationToken ct = default);
    Task<Result> WithdrawAsync(Guid classId, Guid studentId, CancellationToken ct = default);
}
