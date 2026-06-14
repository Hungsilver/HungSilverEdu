using AutoMapper;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Journals;

public sealed class JournalProfile : Profile
{
    public JournalProfile()
    {
        CreateMap<TeacherJournal, TeacherJournalDto>();
    }
}
