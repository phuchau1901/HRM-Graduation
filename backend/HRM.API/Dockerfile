
# ==========================
# STAGE 1: BUILD
# ==========================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

COPY . .

RUN dotnet restore HRM.API.csproj

RUN dotnet publish HRM.API.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# ==========================
# STAGE 2: RUNTIME
# ==========================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime

WORKDIR /app

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://0.0.0.0:8080

EXPOSE 8080

ENTRYPOINT ["dotnet", "HRM.API.dll"]
