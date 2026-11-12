# Katkı Rehberi

LocalOps'a hata bildirimi, belge, çeviri, test ve kod iyileştirmeleriyle katkıda bulunabilirsiniz. Katılım sırasında [davranış kurallarına](CODE_OF_CONDUCT.md) uyun.

## Hata ve özellik bildirimleri

Önce [mevcut issue'ları](https://github.com/Taxperia/LocalOps/issues) kontrol edin. Yeni bir hata bildirirken şunları ekleyin:

- LocalOps sürümü ve Windows sürümü/build numarası.
- Hatayı yeniden oluşturmak için gereken adımlar.
- Beklenen ve gerçekleşen davranış.
- İlgili hata mesajı veya kişisel bilgileri gizlenmiş ekran görüntüsü.
- Sorunun kurulu uygulamada mı, `npm run dev` sırasında mı görüldüğü.

Güvenlik açıklarını herkese açık issue olarak paylaşmayın; [SECURITY.md](SECURITY.md) içindeki özel kanalı kullanın. Büyük özellikler veya kapsamlı değişiklikler için kod yazmadan önce bir issue ile kapsamı görüşün.

## Geliştirme ortamı

- Windows 10/11 x64.
- Node.js 22.12 veya üzeri; Node.js 24 önerilir.
- Git ve npm. Sistem verileri için Windows PowerShell/CIM kullanılır.

Depoyu kendi hesabınıza fork edin, fork'unuzu klonlayın ve bir dal açın:

```bash
git switch -c fix/kisa-aciklama
npm ci
npm run dev
```

## Değişiklik ilkeleri

- Değişikliği tek bir sorun veya özellik etrafında tutun; ilgisiz yeniden biçimlendirmelerden kaçının.
- TypeScript strict kontrolünü koruyun. Ortak tipleri `src/shared` içinde tanımlayın.
- Sistem işlemlerini `src/main`, dar kapsamlı IPC köprüsünü `src/preload`, arayüzü `src/renderer` içinde tutun.
- Renderer'a Node.js veya genel amaçlı IPC erişimi açmayın. IPC girdilerini ana süreçte doğrulayın; kaynak ve çerçeve kontrollerini koruyun.
- Kullanıcıya gösterilen metinleri hem Türkçe hem İngilizce çeviri dosyalarına ekleyin.
- Desteklenmeyen sensörler için açık bir durum gösterin; gerçek sistem verilerinin yerine örnek değer koymayın.
- Düzeltmeler için hatayı önce yakalayan bir regresyon testi ekleyin. Veri akışlarında yalnızca boş bir dizinin türünü değil, beklenen veriyi de doğrulayın.
- `.env`, anahtar, sertifika, kişisel log ve yerel test çıktıları göndermeyin. Ekran görüntülerinde kullanıcı adı, bilgisayar adı, dosya yolu ve IP adreslerini kontrol edin.

## Doğrulama

Pull request açmadan önce ilgili kontrolleri çalıştırın:

```bash
npm run typecheck
npm test
npm audit --audit-level=moderate
npm run build
npm run test:e2e
```

Arayüz testleri önceki adımda derlenmiş uygulamayı ve ayrı geçici ayarları kullanır. Geliştirme sunucusundaki veri akışını da denetler. Güvenli test verileri kullanın; testleri gerçek işlemleri sonlandıracak, program kaldıracak veya kullanıcının dosyalarını silecek şekilde yazmayın.

Kurulum veya güncelleme mekanizmasını değiştiriyorsanız `npm run dist` ile Windows paketini de doğrulayın. Sürüm ve Git etiketi oluşturma işlemleri bakımcı tarafından koordine edilir.

## Pull request

Değişikliğinizi fork'unuza gönderip bu deponun `main` dalına pull request açın. Açıklamada çözülen sorunu, yeni davranışı ve çalıştırdığınız kontrolleri belirtin. Arayüz değişikliklerinde ekran görüntüsü ekleyin; ilgili issue varsa bağlantı verin. Bilinen sınırlamaları açıkça yazın.

GitHub Actions kontrollerinin başarılı olması beklenir. Kod incelemesindeki düzeltmeleri aynı dalda sürdürün.

Katkılar projenin [MIT lisansı](LICENSE) kapsamında sunulur.
