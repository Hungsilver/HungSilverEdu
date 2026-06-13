using HungSilver.Application.Common.Models;
using HungSilver.Application.Products;
using HungSilver.Domain.Common;
using HungSilver.WebApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HungSilver.WebApi.Controllers;

[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController(IProductService productService) : ControllerBase
{
    /// <summary>User thường chỉ thấy sản phẩm chưa xóa; Admin có thể xem cả bản ghi xóa mềm.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductDto>>> GetProducts(
        [FromQuery] PagedRequest request,
        [FromQuery] bool includeDeleted = false,
        CancellationToken ct = default)
    {
        var canSeeDeleted = includeDeleted && User.IsInRole(AppRoles.Admin);
        return (await productService.GetPagedAsync(request, canSeeDeleted, ct)).ToActionResult();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDto>> GetProduct(Guid id, CancellationToken ct) =>
        (await productService.GetByIdAsync(id, ct)).ToActionResult();

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ProductDto>> Create(CreateProductRequest request, CancellationToken ct) =>
        (await productService.CreateAsync(request, ct)).ToActionResult();

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ProductDto>> Update(Guid id, UpdateProductRequest request, CancellationToken ct) =>
        (await productService.UpdateAsync(id, request, ct)).ToActionResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken ct) =>
        (await productService.DeleteAsync(id, ct)).ToActionResult();

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken ct) =>
        (await productService.RestoreAsync(id, ct)).ToActionResult();
}
