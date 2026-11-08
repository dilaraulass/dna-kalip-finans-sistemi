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
$csrf = Invoke-RestMethod -Uri "http://localhost:5257/api/auth/csrf" -SessionVariable dnaSession
Invoke-RestMethod -Method Post -Uri "http://localhost:5257/api/dev/seed-from-json" -WebSession $dnaSession -Headers @{ "X-CSRF-TOKEN" = $csrf.token }
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

## Production Yayını İçin Kalanlar

Bu depo henüz tek başına production yayını için yeterli değildir. `deploy/docker-compose.test.yml`
yalnızca test içindir; gerçek ortam için aşağıdaki yayın kapıları tamamlanmalıdır:

- Hedef domain, TLS sertifikası, reverse proxy ve yalnızca bilinen proxy'lere güvenen
  forwarded-header yapılandırması belirlenmeli. Proxy arkasındaki rate limit gerçek istemci
  IP'siyle doğrulanmalı.
- Production SQL Server ayrı ve yönetilen bir ortamda çalışmalı; ağ erişimi sınırlandırılmalı,
  bağlantı şifresi secret store/environment üzerinden verilmeli, TLS doğrulaması kapatılmamalı.
- İlk admin parolası tek seferlik ve güçlü olmalı; kurulum sonrası `Auth:InitialAdmin:Enabled`
  kapatılmalı. Data Protection key'leri yedeklenmeli ve birden fazla API instance'ı varsa
  paylaşılan/korumalı depolamada tutulmalı.
- Migration öncesi yedek ve geri dönüş planı hazırlanmalı; otomatik migration production'da
  varsayılan olarak kapalı tutulmalı.
- SQL dahil readiness/health kontrolleri, merkezi loglama, hata/başarısız giriş alarmı ve
  yedek geri yükleme tatbikatı kurulmalı. Mevcut `/health` endpoint'i veritabanı bağlantısını
  doğrulamaz.
- CI/CD hattı ve release onayları kurulmalı. Yetki/iş akışı için hedef ortamda kabul testi,
  yedek/geri yükleme, tarayıcı ve eşzamanlı kullanıcı testi yapılmalı.
- Yayın öncesi `npm audit --omit=dev` ve `dotnet list package --vulnerable --include-transitive`
  yeniden çalıştırılmalı; bulgular giderilmeden sürüm çıkarılmamalı.
- Frontend production build'inde ana JS paketi 1 MB üzerindedir; modül bazlı code-splitting ve
  gerçek kullanımda yükleme süresi ölçümü yapılmalıdır.

## Kullanıcı Yetkileri ve Sözleşme Tamamlama

- Admin yeni rol tanımlar; rolün izinlerini kullanıcıya özel izin/engel ile değiştirebilir. Kullanıcıdaki “Rolünden” seçeneği rolün güncel ayarını izler.
- Mevcut Muhasebe rolünün hakları migration ile korunur; Admin tüm yetkilere sahiptir. Son aktif admin pasifleştirilemez.
- Sözleşme hazırlama ve finansal düzenleme yetkisi olan kişi doğrudan aktif sözleşme oluşturabilir veya taslak kaydedebilir.
- Sadece hazırlama yetkisi olan kişi teknik taslak oluşturur, finans yetkilisini seçip tamamlamaya gönderir. Sorumlu kişi uygulama içi bildirim alır; finansal alanları kaydedip aktifleştirir veya açıklamayla iade eder. E-posta gönderilmez.
- Taslak/bekleyen kayıtlar finans hesaplarına girmez. Bu kayıtları yalnızca hazırlayan, atanan kişi ve admin görüntüler. Mevcut sözleşmeler migration sonrasında aktif kalır.
- Finans görüntüleme izni olmayan kullanıcıya tutarlar API'de `null`, ekranda `***` döner. Belgenin `FormDataJson` alanı yalnızca izinli teknik alanları içerir. Yeni teknik alan eklenirse sunucu allowlist'i de güncellenmelidir.
- Çıktı yetkisi uygulamadaki Excel/PDF düğmelerini kontrol eder; tarayıcının kendi yazdırma ve ekran görüntüsü özelliklerini engellemez. Gizli tutarlar zaten istemciye gönderilmez.
- Yetkiler her API isteğinde yeniden okunur. Arayüz 30 saniyede bir ve pencereye dönüşte izinleri yeniler. Yetki değişiklikleri/iş akışı adımları adminin işlem kayıtlarında görünür.
- Sözleşme güncellemesi ve iş akışı istekleri detay yanıtındaki `version` değerini göndermelidir; eski sürüm için `409` dönülür.

### Kurulum / güncelleme sırası

Bu değişiklik, `AddPermissionsAndContractWorkflow` migration'ını gerektirir. Kullanılan connection string'i kontrol edin; gerçek veride yedek aldıktan sonra backend'i durdurup migration uygulayın:

```powershell
dotnet ef database update --project backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj --configuration Release
```

Ardından backend'i yeniden başlatın ve frontend'i yenileyin/yeniden yayınlayın. Yeni API'yi eski şemayla çalıştırmayın. Bu migration rol/kullanıcı izinleri, işlem kayıtları ve bildirim tablolarını; sözleşmelere durum, sorumlu ve sürüm alanlarını ekler.

### Tekrarlanabilir kontroller

```powershell
npm run lint
npm test
npm run build
dotnet run --project backend-dna/tests/DnaKalip.SecurityChecks/DnaKalip.SecurityChecks.csproj --configuration Release
```

Gerçek API + SQL testi ayrı, rastgele isimli `DnaKalip_SecurityCheck_*` veritabanı oluşturur ve sonunda yalnızca bu veritabanını siler. Test kullanıcısının veritabanı oluşturma/silme yetkisi gerekir; uygulamanın veritabanına bağlanmaz. Varsayılan sunucu `localhost\SQL2022`, isteğe bağlı argüman `--server=SUNUCU`:

```powershell
dotnet run --project backend-dna/tests/DnaKalip.SecurityChecks/DnaKalip.SecurityChecks.csproj --configuration Release -- --integration
```

Manuel kabul: Teknik kullanıcıyla taslak hazırlayıp bir finans yetkilisine gönderin. Yetkili hesaptan bildirimi açıp bedel/ödeme planını kaydedin, aktifleştirin. Teknik kullanıcıda tutarların `***`, finans yetkilisinde gerçek değer olduğunu kontrol edin. Adminin kullanıcıya finans görüntüleme hakkını kaldırmasının sonraki API isteğinde etkili olduğunu doğrulayın.
