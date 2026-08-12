# DNA Kalıp Finans ve Sözleşme Sistemi

DNA Kalıp için geliştirilen finans, sözleşme, firma ve ödeme takip uygulaması.

Proje şu anda geliştirme aşamasındadır. README dosyası yaşayan teknik doküman olarak tutulur; yeni modüller tamamlandıkça güncellenmelidir.

## Teknolojiler

- Frontend: React, Vite, React Router, MUI DataGrid
- Backend: ASP.NET Core Minimal API
- Veritabanı: SQL Server
- ORM: Entity Framework Core
- Test: Node.js test runner

## Proje Yapısı

```text
dna-kalip-app/
├─ src/                         React frontend
│  ├─ pages/                    Sayfalar
│  ├─ components/               Ortak ve modül componentleri
│  ├─ services/                 Frontend API ve hesaplama servisleri
│  ├─ constants/                Frontend sabitleri
│  └─ data/                     Geliştirme/import amaçlı eski JSON veri
│
├─ backend-dna/
│  └─ src/DnaKalip.Api/         ASP.NET Core backend
│     ├─ Endpoints/             API endpointleri
│     ├─ Entities/              EF Core entity modelleri
│     ├─ Dtos/                  Request/response modelleri
│     ├─ Data/                  DbContext
│     ├─ Migrations/            EF Core migration dosyaları
│     └─ Services/              Backend servisleri
```

## Modüller

Mevcut ana modüller:

- Finans
  - Tedarikçi ödemeleri
  - Müşteri tahsilatları
  - Ek gider faturaları
  - Finansal analiz
- Sözleşmeler
  - Sözleşme oluşturma
  - Sözleşme düzenleme
  - Sözleşme önizleme / çıktı alma
  - Arşivleme ve arşivden çıkarma
- Firmalar
  - Firma listeleme
  - Firma ekleme
  - Firma düzenleme
  - Firmaya bağlı sözleşmeleri görüntüleme

## Gereksinimler

- Node.js
- npm
- .NET SDK
- SQL Server
- dotnet-ef aracı

Kurulu .NET SDK sürümlerini kontrol etmek için:

```powershell
dotnet --list-sdks
```

EF Core CLI kurulu değilse:

```powershell
dotnet tool install --global dotnet-ef
```

## Kurulum

Bağımlılıkları yüklemek için proje kökünde:

```powershell
npm install
```

## Backend Çalıştırma

Proje kökünde:

```powershell
dotnet run --project backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj --launch-profile http
```

Varsayılan backend adresi:

```text
http://localhost:5257
```

Health endpoint:

```text
GET http://localhost:5257/health
```

## Frontend Çalıştırma

Ayrı bir terminalde proje kökünde:

```powershell
npm run dev
```

Varsayılan frontend adresi:

```text
http://localhost:5173
```

## Veritabanı

Development connection string:

```text
Server=localhost\SQL2022;Database=DnaKalipDb;Trusted_Connection=True;TrustServerCertificate=True
```

Migration uygulamak için:

```powershell
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet ef database update --project backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj
```

Backend çalışıyorsa ve `.exe` dosyası kilitlenirse:

```powershell
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet build backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj --no-restore /p:UseAppHost=false
dotnet ef database update --project backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj --no-build
```

## Geliştirme Seed Endpointi

Eski JSON verisini development ortamında SQL Server’a aktarmak için:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:5257/api/dev/seed-from-json"
```

Bu endpoint sadece development amaçlıdır. Production ortamında kullanılmamalıdır.

## Kontrol Komutları

Frontend lint:

```powershell
npm run lint
```

Frontend build:

```powershell
npm run build
```

Frontend test:

```powershell
npm test
```

Backend build:

```powershell
dotnet build backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj --no-restore
```

Backend `.exe` kilidi varsa geçici output ile build:

```powershell
dotnet build backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj --no-restore -o .backend-build-check
```

## API Özet

Başlıca endpointler:

```text
GET    /api/finance/dashboard
PUT    /api/contract-milestones/{milestoneId}/payment-tracking
POST   /api/expense-invoices
PUT    /api/expense-invoices/{id}
PATCH  /api/expense-invoices/{id}/archive

GET    /api/contracts
GET    /api/contracts/{id}
POST   /api/contracts
PUT    /api/contracts/{id}
PATCH  /api/contracts/{id}/archive
PATCH  /api/contracts/{id}/restore

GET    /api/companies
GET    /api/companies/{id}
POST   /api/companies
PUT    /api/companies/{id}
```

## Geliştirme Notları

- Sözleşme ve ek gider kayıtlarında fiziksel silme yerine arşivleme tercih edilir.
- Arşivlenen sözleşmeler finans hesaplarına dahil edilmez.
- Arşivlenen ek gider faturaları finans dashboard ve analiz toplamlarına dahil edilmez.
- Sözleşme formunun detaylı alanları `FormDataJson` içinde saklanır.
- Hakediş ve ödeme planları backend tarafında milestone kayıtlarına senkronlanır.
- `src/data/database.json` eski HTML uygulamasından geçiş/import amacıyla kullanılır; uzun vadede ana veri kaynağı SQL Server’dır.

## Production Öncesi Yapılacaklar

- Login ve yetkilendirme
- Production connection string ve secret yönetimi
- Seed endpointinin production’da kapalı olduğunun doğrulanması
- Backup stratejisi
- Hata loglama ve izleme
- Deployment dokümantasyonu
