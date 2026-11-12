# Güvenlik Politikası

## Desteklenen sürümler

Güvenlik düzeltmeleri [GitHub Releases](https://github.com/Taxperia/LocalOps/releases/latest) üzerindeki en güncel kararlı sürüm için hazırlanır. Eski sürümleri kullanıyorsanız önce güncelleyin.

| Sürüm | Güvenlik düzeltmeleri |
| --- | --- |
| En güncel kararlı sürüm | Desteklenir |
| Önceki sürümler ve ön sürümler | Desteklenmez |

## Bir güvenlik açığı bildirme

[GitHub üzerinden özel güvenlik raporu oluşturun](https://github.com/Taxperia/LocalOps/security/advisories/new). Depoda özel güvenlik açığı bildirimi etkindir.

Açığın ayrıntılarını, çalışan istismar kodunu veya gizli verileri herkese açık issue, pull request ya da tartışmalarda paylaşmayın. Genel kullanım hataları için [issue sayfasını](https://github.com/Taxperia/LocalOps/issues) kullanabilirsiniz.

Rapora mümkün olduğunca şu bilgileri ekleyin:

- Etkilenen LocalOps sürümü, Windows sürümü ve çalıştırma biçimi.
- Etkilenen bileşen, ön koşullar ve gerekli yetkiler.
- Kısa, güvenli ve tekrarlanabilir doğrulama adımları.
- Beklenen güvenlik sınırı ile gözlenen sonuç ve olası etki.
- Varsa ilgili kaynak dosyası, commit veya düzeltme önerisi.

Gerçek parola, erişim anahtarı, kullanıcı dosyası ya da kişisel bilgi eklemeyin. Ekran görüntülerini ve logları paylaşmadan önce hassas bilgileri kaldırın. Değerlendirme ve düzeltme görüşmesini özel raporda sürdürün; kamuya açıklamayı bakımcıyla koordine edin.

## İnceleme kapsamı

Özellikle renderer/main süreç sınırları, IPC doğrulaması, PowerShell girdileri, dosya işlemleri, yetki kullanımı, bağımlılıklar ve güncelleme bütünlüğüyle ilgili somut bulgular değerlidir.

Doğrulamayı kendi yetkili test ortamınızda ve örnek verilerle yapın. Başka kullanıcıların verilerini, üretim sistemlerini veya GitHub altyapısını hedef almayın. Yıkıcı işlem, kalıcılık veya hizmet kesintisi oluşturan testler uygulamayın.

## Mevcut güvenlik davranışı

- Renderer, sandbox ve context isolation ile çalışır; Node integration kapalıdır.
- IPC çağrıları uygulamanın ana penceresindeki güvenilir ana çerçeveden kabul edilir.
- Güncellemeler sabit `Taxperia/LocalOps` deposundan HTTPS ile alınır; indirilen paketin SHA512 özeti doğrulanır. Kurulum kullanıcı tarafından başlatılır.
- Sistem metrikleri yerelde saklanır. Güncelleme denetimi ve indirmesi GitHub'a ağ istekleri gönderir.
- Windows kod imza sertifikası henüz yapılandırılmamıştır; kurulum doğrulanmış bir Authenticode yayıncı kimliği sunmaz.

Bu kontrollerin bulunması yeni bir açığın mümkün olmadığı anlamına gelmez. Somut bulgular için özel raporlama kanalını kullanın.
