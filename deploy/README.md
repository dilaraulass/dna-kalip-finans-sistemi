# DNA Kalıp test yayını

Bu klasör test yayını için örnek dosyaları içerir.

## Docker ile hızlı test

1. Örnek env dosyasını kopyala:

```powershell
Copy-Item deploy/.env.example deploy/.env
```

2. `deploy/.env` içindeki şifreleri değiştir.

3. Test ortamını ayağa kaldır:

```powershell
docker compose --env-file deploy/.env -f deploy/docker-compose.test.yml up --build
```

4. Uygulamayı aç:

```text
http://localhost:8080
```

Bu compose dosyasında migration başlangıçta otomatik uygulanır ve aktif admin yoksa env dosyasındaki ilk admin oluşturulur. Gerçek production için SQL Server ayrı yönetilmeli, connection string ve admin şifresi dosyada değil sunucu secret/environment ayarlarında tutulmalıdır.

## Nginx örneği

`deploy/nginx/dna-api.conf` tek domain altında frontend ve backend'i aynı ASP.NET Core uygulamasına proxy eder:

```text
https://app.example.com
https://app.example.com/api
```

Gerçek domain için `app.example.com` değerlerini `app.dnakalip.co` veya test domain ile değiştir.
