# LocalOps — Geliştirme Günlüğü

> **LocalOps — Your Windows. Fully Under Control.**
> Windows 10/11 için modern, gerçek sistem verileriyle çalışan sistem yönetim uygulaması.

---

## Genel Durum

| Faz | Kapsam | Durum |
|---|---|---|
| Faz 1 | Altyapı, UI çatısı, Dashboard, Ayarlar, canlı monitör, Process Manager v1 | ✅ **Tamamlandı (v0.1.0)** |
| Faz 2 | Network Monitor, Process Manager derinleştirme, Performance | ✅ **Tamamlandı (v0.2.0)** |
| Faz 3 | Services, Startup, App Manager, Event Viewer, Disk Analyzer, System Info | ✅ **Tamamlandı (v0.2.0)** |
| Faz 4 | Task Scheduler, Driver Manager, Power, Cleanup, Health, Diagnostics, Automation, History & Reports | ✅ **Tamamlandı (v0.3.0)** |
| Faz 5 | Bundle bölme, yönetici yeniden başlatma, Windows installer | ✅ **Tamamlandı (v0.3.0)** |

**20/20 modül gerçek veriyle çalışıyor.**

## Modül Tablosu (20 modül)

| # | Modül | Durum | Not |
|---|---|---|---|
| 1 | Dashboard | ✅ | Canlı CPU/RAM/GPU/Disk/Ağ/Pil/Sistem widget'ları; sürükle-bırak, kalıcı düzen |
| 2 | Process Manager | ✅ v2 | Sanallaştırılmış tablo, ağaç görünümü, kullanıcı adı + "yanıt vermiyor", detay paneli (imza), sonlandırma, öncelik |
| 3 | Performance Monitor | ✅ | 2dk/5dk/15dk geçmiş; CPU/RAM/Disk/Ağ grafikleri + çekirdek çubukları |
| 4 | Startup Manager | ✅ | Run/RunOnce + klasörler; StartupApproved ile etkin/devre dışı |
| 5 | Services Manager | ✅ | Başlat/durdur/yeniden başlat, başlangıç türü, kritik servis uyarısı |
| 6 | Disk Analyzer | ✅ | Arka plan worker, canlı ilerleme, drill-down + önbellek, en büyük dosyalar |
| 7 | Network Monitor | ✅ | TCP+UDP tablosu (CIM + netstat yedek), işlem eşleme, canlı |
| 8 | System Information | ✅ | Tam donanım envanteri; JSON kopyalama |
| 9 | Event Viewer | ✅ | 4 günlük, düzey/aralık filtreleri, arama, detay, daha fazla yükle |
| 10 | App Manager | ✅ | Registry envanteri + onaylı kaldırıcı başlatma |
| 11 | Task Scheduler | ✅ v1 | Get-ScheduledTask + TaskInfo; Çalıştır/Bitir/Etkin-Devre dışı (onaylı), kullanıcı görevleri filtresi |
| 12 | File Inspector | ✅ v1 (işlem entegre) | İşlem detayında Authenticode imza + dosya sürüm bilgisi; bağımsız dosya modülü v2 backlog |
| 13 | Driver Manager | ✅ v1 | Win32_PnPSignedDriver listesi (10 dk önbellek) + sorunlu cihaz kodları (Win32_PnPEntity) |
| 14 | Power Manager | ✅ v1 | powercfg planları + etkinleştirme (onaylı), pil durumu/çalışma süresi |
| 15 | Cleanup Center | ✅ v1 | 4 hedef (kullanıcı/Windows temp, WU önbelleği, thumbnail); analiz → önizleme → onaylı silme; saklama süresi ayarı |
| 16 | System Health | ✅ v1 | Storage Reliability Counter (sıcaklık/yıpranma/hatalar), ACPI termal bölge, pil detayı; desteklenmeyen veri açıkça belirtilir |
| 17 | Automation Center | ✅ v1 | Kullanıcı kuralları (metrik/eşik/süre/susturma), ayarlarda saklanır, engine her tick'te değerlendirir, Windows bildirimi + toast, test tetikleme |
| 18 | Diagnostics | ✅ v1 | Disk/bellek/hata olayı/bekleyen restart/AV/sayfa dosyası denetimleri (saf kural motoru, testli), rapor kopyalama |
| 19 | History & Reports | ✅ v1 | **node:sqlite kalıcı kayıt (30 sn)** + JSONL yedek; aralık istatistikleri (ort/max/min), CSV/JSON dışa aktarım, saklama süresi |
| 20 | Settings | ✅ v2 | Dil, vurgu, aralık, akıllı uyarılar, widget'lar, hakkında + yönetici olarak yeniden başlat |

## v0.3.0 — Faz 4 + Faz 5 (2026-11-01)

### Yeni backend
- **TaskSchedulerService:** envanter (Get-ScheduledTask + TaskInfo); Start/Stop/Enable/Disable — yol/ad doğrulaması, zaman aşımı
- **DriverService:** yavaş sorgu için tek uçuş + 10 dk önbellek; sorunlu cihazlar ayrı liste
- **PowerService:** powercfg /list + /getactivescheme ayrıştırma (GUID regex, dil-bağımsız), /setactive
- **CleanupService:** hedef bazlı tarama (boyut + dosya sayısı + en büyük 10) ve kesin zaman dilimli silme; silinemeyenler sayılır
- **HealthService:** Storage Reliability Counter + ACPI termal bölge (Kelvin→°C, aralık filtresi) + EstimatedRunTime sentinel koruması
- **DiagnosticsService:** PS ile girdi toplama (pending reboot registry, SecurityCenter2 AV, 24 saatlik hata sayımı, pagefile) → **paylaşılan saf kural motoru** (testli)
- **HistoryService:** `node:sqlite` (Electron 38 gömülü, `createRequire` ile lazy yükleme) → tablo: metrics(ts PK, cpu, mem, diskRead/Write, netRecv/Sent); modül yoksa JSONL otomatik yedek; saatlik prune (1-90 gün)
- **AutomationService:** kural değerlendirme (overSince/lastFired); "hiç tetiklenmedi" durumu cooldown'u engellemez; Windows Notification + `automation:fired` olayı
- MetricsEngine'e `recordPoint` (30 sn) ve `evaluateAutomations` kancaları

### Yeni sayfalar (8)
Görev Zamanlayıcı · Sürücüler · Güç · Temizlik Merkezi · Sistem Sağlığı · Tanılama · Otomasyon Merkezi · Raporlar
Sidebar 4 grup (İzleme/Sistem/Araçlar/Genel), komut paleti 19 sayfa komutu.

### Faz 5
- **Bundle bölme:** vendor (react+zustand, 20 KB) / charts (recharts, 857 KB) / app (983 KB) — paralel yüklenebilir chunk'lar
- **Yönetici olarak yeniden başlat:** `Start-Process -Verb RunAs` (yalnızca paketlenmiş sürümde; UAC onaylı)
- **Windows installer:** electron-builder 26 + NSIS (`npm run dist` → `dist/LocalOps-Setup-0.3.0.exe`), kurulum dizini seçilebilir

## Faz 1-2-3 (v0.1.0 - v0.2.0) özeti

- Electron 38 + React 19 + TS strict + electron-vite (Vite 6) + Tailwind 4 + Zustand + Recharts; **native modül yok** (os + PowerShell/CIM)
- Kalıcı PS örnekleyiciler (1 sn performans / 2 sn işlem / 15 sn meta), NDJSON, otomatik restart
- tasklist /v zenginleştirme (OEM kod sayfası), StartupApproved, uninstall registry'leri, `\\?\` uzun yol tarama
- Güvenlik: contextIsolation, sender denetimi, kanal beyaz listesi, parametre doğrulama, onay diyaloğu, yetki rozeti

## Doğrulama (bu makinede, 2026-11-01)

- `npm run typecheck` → **0 hata** (strict)
- `npm test` → **48/48 geçti** (format, metricsMath, settingsSchema, fuzzy, csv, automation, diagnostics)
- `npm run build` → main 118 KB / preload 6.3 KB / vendor 20 KB + charts 857 KB + app 983 KB
- **Smoke test:** dev mod başlatıldı → 0 hata; **`metrics.db` oluştu ve 30 sn'lik kalıcı kayıt aktif** (node:sqlite yüklendi)
- **Veri kaynakları:** 331 servis, 524 bağlantı, 170 uygulama, olay günlükleri, Run değerleri — tümü gerçek
- **Installer:** `npm run dist` → `dist/LocalOps-Setup-0.3.0.exe`

## Mimari Kararlar

1. **Native modül yok:** os + PowerShell/CIM; node-gyp/ABI derleme riski sıfır.
2. **Kalıcı örnekleyiciler + NDJSON:** akıcı 1 sn veri, satır bazlı hata toleransı.
3. **Dil-bağımsız veri:** `Win32_PerfFormattedData_*` İngilizce özellikler; tasklist OEM CP; powercfg GUID regex.
4. **StartupApproved uyumluluğu:** Görev Yöneticisi mekanizmasının birebir aynısı.
5. **node:sqlite + JSONL yedek:** gömülü SQLite (Electron ≥35) varsa gerçek DB; yoksa şeffaf JSONL.
6. **Saf kural motorları:** otomasyon ve tanılama kararları `shared/` içinde test edilebilir.
7. **CPU ölçeği:** Görev Yöneticisi standardı; uydurma metrik yok — desteklenmeyen sensör "raporlanmıyor" gösterilir.

## Sonraki sürümler için fikirler (v2 backlog)

- [ ] Bağımsız File Inspector sayfası (dosya hash + imza + metadata)
- [ ] Cleanup'e tarayıcı önbellekleri + Geri Dönüşüm Kutusu
- [ ] Process askıya alma (NtSuspendProcess native çağrısı gerekir)
- [ ] Rapor sayfasına dönem karşılaştırma grafikleri
- [ ] Otomasyon kurallarına aksiyon seçimi (bildirim dışında komut çalıştırma)
- [ ] code signing + auto-update (electron-updater)
