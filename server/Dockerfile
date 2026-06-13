FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish src/HungSilver.WebApi/HungSilver.WebApi.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
# Image aspnet 8+ mặc định lắng nghe 8080 (ASPNETCORE_HTTP_PORTS=8080)
EXPOSE 8080
ENTRYPOINT ["dotnet", "HungSilver.WebApi.dll"]
