using AutoMapper;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Students;

public sealed class StudentProfile : Profile
{
    public StudentProfile()
    {
        CreateMap<Student, StudentDto>()
            .ConstructUsing(s => new StudentDto(
                s.Id, s.StudentCode, s.FullName, s.DateOfBirth, s.School, s.GradeLevel,
                s.Phone, s.ParentName, s.ParentPhone, s.Address, s.Email, s.Note,
                s.EnrollmentDate, s.EnglishLevel, s.LearningGoal, s.Curriculum, s.UserId,
                s.IsActive, s.IsDeleted, s.CreatedAt, s.UpdatedAt, Array.Empty<StudentClassDto>()));
    }
}
