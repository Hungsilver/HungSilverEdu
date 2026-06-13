using FluentValidation;
using HungSilver.Application.Products;
using Microsoft.Extensions.DependencyInjection;

namespace HungSilver.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);
        services.AddScoped<IProductService, ProductService>();
        return services;
    }
}
