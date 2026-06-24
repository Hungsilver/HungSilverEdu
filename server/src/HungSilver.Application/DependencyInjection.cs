using FluentValidation;
using HungSilver.Application.Branches;
using HungSilver.Application.Common;
using HungSilver.Application.Grades;
using HungSilver.Application.Journals;
using HungSilver.Application.Materials;
using HungSilver.Application.PointReasons;
using HungSilver.Application.Students;
using HungSilver.Application.Subjects;
using Microsoft.Extensions.DependencyInjection;

namespace HungSilver.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);
        services.AddAutoMapper(typeof(DependencyInjection).Assembly);

        services.AddScoped<IStudentService, StudentService>();
        services.AddScoped<IClassAccessGuard, ClassAccessGuard>();
        services.AddScoped<ITeacherJournalService, TeacherJournalService>();
        services.AddScoped<IMaterialService, MaterialService>();
        services.AddScoped<IMaterialCategoryService, MaterialCategoryService>();
        services.AddScoped<ISubjectService, SubjectService>();
        services.AddScoped<IBranchService, BranchService>();
        services.AddScoped<IGradeService, GradeService>();
        services.AddScoped<IPointReasonService, PointReasonService>();
        return services;
    }
}
