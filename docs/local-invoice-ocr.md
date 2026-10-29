# Yerel faturadan doldurma

## Kullanım

Finans > Ek Gider Faturaları > Yeni Fatura > Faturadan Doldur.
PDF/JPG/PNG seçin. Okunan bilgiler doğrudan mevcut forma doldurulur ve
“Faturadan alındı” işaretiyle gösterilir. Belge önizlemesiyle karşılaştırın,
gerekirse düzeltin; firma ve gider türünü seçip Fatura Ekle ile kaydedin.
Ayrı aktarım/onay kutusu yoktur; kayıt butonu kullanıcı onayıdır.
Okuma tek başına kayıt oluşturmaz. Elle değiştirilmiş alanlar korunur.
`expenses.edit` ve `finance.view` izinleri gerekir. Mevcut API yetkileri değişmez.

## İşleme ve sınırlar

- PDF.js metinli PDF'yi doğrudan okur; az metinli/taranmış sayfalar ve görseller
  Tesseract.js (`tur+eng`, LSTM) ile tarayıcıdaki worker'da okunur.
- Belge/OCR metni dış hizmete veya backend'e gönderilmez. Yalnızca kullanıcının
  onayladığı mevcut form alanları normal kayıt API'sine gider.
- Dosya uzantısı ve imzası kontrol edilir. En fazla 10 MB, PDF için 5 sayfa,
  görsel için 24 megapiksel; okuma süresi en fazla 3 dakika. Şifreli PDF desteklenmez.
- Bir seferde tek fatura beklenir. Çok faturanın birleştirildiği belgeleri kullanmayın.
- Etiketli fatura no/tarih, ödenecek veya genel toplam, toplamla aynı satırdaki
  para birimi ve açıkça yazılmış gün cinsinden vade önerilir.
- Eksik, çelişkili veya belirsiz değerler uydurulmaz. Tutarın para birimi yoksa
  otomatik TRY varsayımı yapılmaz. Bu kural tabanlı ilk sürüm her düzeni tanımaz.
- Tutar önerisi net/matrah değil, ödenecek/genel toplamdır. Kullanıcı tutarın
  kaydetmek istediği tutar olduğunu formda kontrol eder; ayrı KDV muhasebesi eklenmedi.
- Vergi numarası eşleşmeleri olası firma olarak gösterilir. Belgede hem alıcı
  hem satıcı bulunabileceği için `CompanyId` kullanıcı tarafından seçilir.
- İş emri, gider türü ve ödeme yapılmış durumu belgeden tahmin edilmez.
  Mevcut firma geçmişi gider türünü önerebilir; elle girilen/aktarılan vade korunur.
- Kullanıcının değiştirdiği alanlar korunur; tutar/para birimi bir çift olarak korunur.
- Belge yalnızca bellekte önizlenir; ek dosya/arşiv olarak kalıcı saklanmaz.
- Bu özellik yeni bir sunucu tarafı mükerrer kayıt garantisi getirmez. Aynı faturanın
  yeniden kaydını kesin önlemek için ayrıca veri temizliği ve DB benzersizlik
  kuralı planlanmalıdır. Mevcut kayıt/doğrulama API'si aynen kullanılır.

## Kurulum ve yayın

Node 22.13+ veya 24+ gerekir (PDF.js gereksinimi; kullanılan geliştirme ortamı Node 24).

```sh
npm ci
npm run dev
```

`predev` ve `prebuild`, kilitlenmiş npm paketlerindeki worker/WASM ve dil
dosyalarını `public/ocr/` klasörüne kopyalar. Bu hazırlık ağ kullanmaz; sadece
`npm ci` için paket indirme gerekir. `public/ocr/` üretilen içeriktir ve Git'e girmez.
`npm run build` bunları `dist/ocr/` içine dahil eder. Yayına tüm `dist` içeriği
alınmalıdır; yalnızca JS/CSS dosyalarını kopyalamak yeterli değildir.
Worker/model URL'leri aynı origin'e sabitlenmiştir; CDN varsayılanları kullanılmaz.
OCR/PDF kütüphaneleri ilk ihtiyaçta yüklenir. Üretilen yerel varlıklar yaklaşık 50 MB;
tarayıcı yalnızca cihazına uygun çekirdeği ve gereken modelleri indirir.
Harici API anahtarı, ücretli hesap, OS Tesseract kurulumu ve DB migration gerekmez.

## Doğrulama

```sh
npm run lint
npm test
npm run build
```

Otomatik testler: Türkçe/İngilizce sayı biçimleri, etiketli alanlar, yanlış tarih,
çelişen toplamlar/para birimleri, firma adayları, manuel alanların korunması,
dosya imzası/boyutu ve OCR iptali.

Yerel test ekranında yapay PNG/JPG, metinli PDF ve taranmış PDF ile gerçek OCR
çalıştırıldı. Bu kontroller önceki, ayrı aktarım butonlu akışa aittir. Doğrudan
forma doldurma akışının tarayıcı kabul testi kullanıcı tarafından yapılmalıdır. Gerçek veritabanına
fatura eklenmedi; tüm firma düzenleri ve gerçek faturalar için doğruluk garantisi yok.

Manuel kabul: dosyayı seçin, önerileri belgeyle karşılaştırın; manuel bir tutar
yazıp aktarımda korunmasını kontrol edin; iptal/bozuk dosya deneyin; PDF'nin tüm
sayfalarını gözden geçirin; ardından yalnızca test ortamında kayıt akışını doğrulayın.

Güvenlik taramasında mevcut bağımlılıklar için 10 bulgu (9 yüksek, 1 orta) bildirildi;
yeni OCR/PDF paketleri listede değildi. İlgisiz paket yükseltmeleri yapılmadı.
Üretim öncesinde ayrı bir bağımlılık güncelleme ve regresyon kontrolü yapılmalıdır.
