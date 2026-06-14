using AutoMapper;
using HungSilver.Domain.Entities;

namespace HungSilver.Application.Settings;

public sealed class SettingsProfile : Profile
{
    public SettingsProfile()
    {
        CreateMap<AppSetting, SettingDto>();
    }
}
