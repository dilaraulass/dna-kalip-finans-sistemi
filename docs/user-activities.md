# Kullanıcı hareketleri

## Uygulanan geliştirme promptu

Mevcut mimariyi ve AccessAudits kayıtlarını kullanarak Kullanıcı Yönetimi'ne yalnızca adminin erişebildiği bir Kullanıcı Hareketleri sayfası ekle. Kullanıcı adı, işlem, sunucu tarafından üretilen tarih/saat, sözleşme numarası ve iş emri numarasını göster. Her sütunda sunucu tarafında filtreleme ve sıralama, ayrıca sayfalama sağla. Varsayılan sıralama en yeni işlem olsun. Yeni sözleşme, sözleşme güncelleme, hakediş onayı ve vade güncellemelerini kaydet. Başarısız işlemler başarılı hareket üretmesin; kayıt, iş verisiyle aynı transaction içinde yazılsın. Şifre veya doküman içeriği kaydetme. İşlem anındaki kullanıcı adı ve numaraları koru. Eski kayıtlara bilinmeyen tarihsel bilgi uydurma. API, yetki, tarih aralığı, sıralama ve arayüz davranışlarını test et.

## Kapsam ve dosyalar

- `UserActivitiesEndpoints.cs`: admin-only `/api/users/activities`; beş sütunda filtreleme/sıralama, sayfalama ve parametre doğrulama. API hareketleri düzenleme/silme işlemi sunmaz.
- `AccessManagement.cs`, `DnaKalipDbContext.cs`, `AccessService.cs`, `AddUserActivitySnapshots` migration: mevcut kayıt tablosuna üç nullable alan ekler. Yeni tablo veya paket yok.
- `ContractsEndpoints.cs`, `ContractWorkflowEndpoints.cs`: sözleşme ve iş akışı işlemlerinin numara bilgilerini olay anında kaydeder.
- `FinanceEndpoints.cs`: hakediş onayı, vade, ödeme ve sözleşmeye ait fatura bilgilerindeki değişiklikleri aynı SaveChanges içinde kaydeder. Değişmeyen takip kaydı tekrar hareket oluşturmaz.
- `Users.jsx`, `App.jsx`, `UserActivities.jsx`, ilgili CSS ve API dosyaları: kullanıcılar ekranında bağlantı, ayrı admin sayfası, hata/yüklenme/boş liste ve filtreler.
- `activityFilters.js`: Türkiye gün sınırları ve saat gösterimi. Bitiş günü dahil filtre, sonraki gün başlangıcı hariç olarak sorgulanır.

Mevcut kullanıcı/rol işlem kayıtları da gösterilir. Eski kayıtlarda kullanıcı adı güncel kullanıcı tablosundan alınabilir; eksik sözleşme/iş emri numarası boş kalır. Eski, hiç kaydedilmemiş işlemler yeniden oluşturulmaz. Bu ekran tüm HTTP isteklerini, girişleri veya tüm firma/ek gider/kur değişikliklerini kaydeden genel bir sistem logu değildir.

## Kontroller

- Frontend: 25 test geçti; lint ve production build kontrolü.
- Gerçek API + izole SQL Server: 128 kontrol geçti. Ana uygulama veritabanı kullanılmaz; her çalıştırma kendi geçici veritabanını oluşturup temizler.
- Yetkisiz erişim 401/403, geçersiz filtreler 400; tüm sütun filtreleri/sıralamaları, sayfalama, tarih sınırları, otomatik zaman, başarısız işlemler, tekrarlanan takip kaydı ve sonradan ad/numara değiştirilmesi kontrol edildi.
- Tarayıcıda izole test adminiyle giriş, Kullanıcılar bağlantısı, hareket listesi, işlem filtresi ve sıralama etkileşimi kontrol edildi. Native tarih alanını otomasyonla doldurma doğrulanamadı; tarih dönüşümü ve API tarih sınırları otomatik testlerde doğrulandı.
- Migration/model uyumu kontrol edildi. Ana veritabanına migration henüz uygulanmadı.

Proje kökünde tekrar çalıştırma:

```powershell
npm run lint
npm test
npm run build
dotnet run --project backend-dna/tests/DnaKalip.SecurityChecks/DnaKalip.SecurityChecks.csproj -- --integration
dotnet ef migrations has-pending-model-changes --project backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj
```

## Mevcut uygulamada etkinleştirme

Backend'i durdurduktan sonra hedef connection string'in doğru test veritabanını gösterdiğini kontrol et. Migration yalnızca üç nullable sütun ekler, mevcut kayıtları silmez.

```powershell
dotnet ef database update --project backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj
dotnet run --project backend-dna/src/DnaKalip.Api/DnaKalip.Api.csproj --launch-profile http
```

Ardından admin olarak Kullanıcılar → Kullanıcı Hareketleri'ni aç. Yeni bir test sözleşmesi veya hakediş/vade değişikliği yapıp kullanıcı, işlem, numaralar ve saati kontrol et.

Mevcut bağımlılıkta `System.Security.Cryptography.Pkcs 9.0.4` için NU1902/NU1903 uyarısı ve frontend bundle büyüklüğü uyarısı devam ediyor. Bu özellik kapsamında bağımlılık veya deploy ayarı değiştirilmedi.
