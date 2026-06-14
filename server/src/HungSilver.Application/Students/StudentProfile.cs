using AutoMapper;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Students;

public sealed class StudentProfile : Profile
{
    public StudentProfile()
    {
        CreateMap<Student, StudentDto>();
    }
}
