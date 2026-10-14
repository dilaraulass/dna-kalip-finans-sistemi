FROM node:24-alpine AS frontend-build
WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js eslint.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src

COPY backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj ./backend-dna/src/DnaKalip.Api/
RUN dotnet restore ./backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj
COPY backend-dna/src/DnaKalip.Api ./backend-dna/src/DnaKalip.Api
COPY --from=frontend-build /src/dist ./backend-dna/src/DnaKalip.Api/wwwroot
RUN dotnet publish ./backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=backend-build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
VOLUME ["/app/App_Data"]
ENTRYPOINT ["dotnet", "DnaKalip.Api.dll"]
