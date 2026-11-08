# Production güvenlik hazırlığı

## Adım 1: giriş güvenliği

- Yeni kullanıcı, şifre sıfırlama ve ilk production admin oluşturma akışında
  12–128 karakter zorunludur. Mevcut hesapların hash'leri değiştirilmez; eski
  şifreyle giriş sürer. Yayından önce zayıf/test şifreleri yönetici tarafından yenilenmelidir.
- Büyük harf/sembol şartı yoktur; uzun şifre cümleleri desteklenir. Mevcut
  baştaki/sondaki boşlukları kırpma davranışı uyumluluk için korunur.
- Login endpoint'i bağlantı IP'si başına bir dakikalık pencerede 10 isteğe izin
  verir (başarılı ve başarısız istekler dahil). Kuyruk yoktur; fazlası 429,
  Retry-After ve Türkçe message döner. Diğer ekranlar bu limite dahil değildir.
- Sayaç uygulama belleğindedir; yeniden başlatılınca sıfırlanır ve sunucular
  arasında paylaşılmaz. Bu ilk katman, hesap bazlı/dağıtık korumanın yerine geçmez.
- Production'da `ReverseProxy:Address` tanımlanırsa yalnızca bu IP'den gelen
  X-Forwarded-For ve X-Forwarded-Proto başlıklarına güvenilir (tek proxy).
  Tanımlı değilse bu başlıklar kullanılmaz. Hedef ortamda gerçek istemci IP'si,
  HTTPS algılama ve şirketin ortak IP yükü test edilmelidir.
- Kötüye kullanılan/yaygın şifre listesi ve şifre değişiminde diğer oturumların
  iptali henüz tamamlanmadı. Her sürümde frontend ve backend bağımlılık taramaları
  tekrarlanmalı; yayın/anahtar/yedekleme güvenliği ayrıca doğrulanmalıdır.

## Adım 2: CSRF

- ASP.NET Core antiforgery cookie/token çifti kullanılır. Cookie HttpOnly,
  SameSite=Strict; production'da Secure zorunludur. Auth cookie değişmez.
- GET /api/auth/csrf oturuma bağlı token döndürür; yanıt cache'lenmez.
- /api altındaki POST/PUT/PATCH/DELETE ve diğer güvenli olmayan yöntemler,
  login/logout ve development seed dahil, X-CSRF-TOKEN gerektirir. Yetkilendirme
  kontrolleri ayrıca geçerlidir. Geçersiz token 403 ve csrf_validation_failed döndürür.
- Frontend csrfFetch her değişiklik öncesi güncel token alır. Tamamlanan token
  localStorage'a veya kalıcı belleğe yazılmaz. Böylece login/logout sonrası eski
  kimliğin token'ı tekrar kullanılmaz. Eşzamanlı token istekleri paylaşılır.
- Başarısız yazma otomatik tekrarlanmaz; kullanıcıya yenileme mesajı gösterilir.
  Çıkış başarısızsa kullanıcıya çıkmış gibi gösterilmez.
- Terminal çağrılarında da aynı cookie oturumu ile token alınmalı ve header'a
  eklenmelidir (README seed örneği). Login/logout sonrasında yeni token alınır.
- Frontend ve backend birlikte yayınlanmalı; eski açık sekmeler yenilenmelidir.
  Bu koruma XSS, yetki kontrolü, HTTPS veya CORS yerine geçmez.

Kaynak: [ASP.NET Core antiforgery](https://learn.microsoft.com/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0).

## Kontrol

```powershell
dotnet build backend-dna/tests/DnaKalip.SecurityChecks -c Release
dotnet run --no-build --project backend-dna/tests/DnaKalip.SecurityChecks -c Release -- --integration
npm run lint
npm test
npm run build
```

Entegrasyon testi yalnızca kendi oluşturduğu geçici SQL veritabanını kullanır.
Manuel: kısa yeni şifreyi reddetme, şifreyi boş bırakıp kullanıcı güncelleme,
eski kullanıcıyla giriş ve art arda giriş isteğinde bekleme mesajını kontrol edin.

Kaynaklar: [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
[ASP.NET Core rate limiting](https://learn.microsoft.com/aspnet/core/performance/rate-limit?view=aspnetcore-10.0).
