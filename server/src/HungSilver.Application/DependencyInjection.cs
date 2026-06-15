using FluentValidation;
using HungSilver.Application.Common;
using HungSilver.Application.Journals;
using HungSilver.Application.Materials;
using HungSilver.Application.Products;
using HungSilver.Application.Students;
using Microsoft.Extensions.DependencyInjection;

namespace HungSilver.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);
        services.AddAutoMapper(typeof(DependencyInjection).Assembly);

        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IStudentService, StudentService>();
        services.AddScoped<IClassAccessGuard, ClassAccessGuard>();
        services.AddScoped<ITeacherJournalService, TeacherJournalService>();
        services.AddScoped<IMaterialService, MaterialService>();
        services.AddScoped<IMaterialCategoryService, MaterialCategoryService>();
        return services;
    }
}
