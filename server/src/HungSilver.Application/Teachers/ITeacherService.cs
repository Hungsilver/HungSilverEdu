using HungSilver.Application.Common.Models;
using HungSilver.Domain.Common.Results;

namespace HungSilver.Application.Teachers;

public interface ITeacherService
{
    Task<Result<PagedResult<TeacherProfileDto>>> GetPagedAsync(PagedRequest request, bool includeDeleted = false, CancellationToken ct = default);
    Task<Result<TeacherDetailDto>> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<TeacherProfileDto>> CreateAsync(CreateTeacherRequest request, CancellationToken ct = default);
    Task<Result<TeacherProfileDto>> UpdateAsync(Guid id, UpdateTeacherRequest request, CancellationToken ct = default);
    Task<Result<TeacherProfileDto>> CreateAccountAsync(CreateTeacherAccountRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<Result<TeacherProfileDto>> LinkAccountAsync(Guid teacherId, LinkAccountRequest request, CancellationToken ct = default);
    Task<Result<TeacherProfileDto>> UnlinkAccountAsync(Guid teacherId, CancellationToken ct = default);
    Task<Result<List<UnlinkedUserDto>>> GetUnlinkedUsersAsync(CancellationToken ct = default);
}
