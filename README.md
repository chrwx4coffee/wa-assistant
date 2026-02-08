# WhatsApp Asistanı (WA Assistant)

WhatsApp Asistanı, Electron tabanlı modern ve güvenli bir toplu mesajlaşma ve otomasyon aracıdır. WhatsApp Web altyapısını kullanarak, Excel dosyalarından veya mevcut rehberinizden seçtiğiniz kişilere kişiselleştirilmiş mesajlar göndermenizi sağlar.

## 🚀 Özellikler

*   **Çoklu Gönderim Modu:**
    *   **Excel Modu:** Kişi listenizi Excel (.xlsx, .xls) dosyasından içe aktarın.
    *   **Web Modu:** Mevcut WhatsApp sohbetleriniz ve gruplarınız arasından seçim yapın.
*   **Akıllı Eşleştirme:**
    *   Excel'deki telefon numaralarını rehberinizdeki kişilerle otomatik olarak eşleştirir.
    *   Eşleşmeyen numaralar için manuel düzeltme ve eşleştirme imkanı sunar.
    *   Numara sütunu olmayan listeler için "Sıralı Eşleştirme" desteği.
*   **Kişiselleştirilmiş Şablonlar:**
    *   Mesajlarınızı `{isim}`, `{tel}` gibi değişkenlerle kişiselleştirin.
    *   Excel dosyasındaki herhangi bir sütunu mesaj şablonunda değişken olarak kullanın (Örn: `{borç}`, `{tarih}`).
*   **Modern ve Kullanıcı Dostu Arayüz:**
    *   Göz alıcı "Glassmorphism" tasarımı.
    *   Kolay kullanım için adım adım sihirbaz yapısı.
    *   Karanlık mod uyumlu modern UI bileşenleri.
*   **Güvenli ve Gizli:**
    *   Verileriniz tamamen yerel cihazınızda işlenir.
    *   WhatsApp oturumu doğrudan kendi bilgisayarınızda yönetilir.

## 🛠️ Kurulum

Projeyi yerel makinenizde çalıştırmak için aşağıdaki adımları izleyin:

1.  **Depoyu Klonlayın:**
    ```bash
    git clone https://github.com/chrwx4coffee/wa-assistant.git
    cd wa-assistant
    ```

2.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

3.  **Uygulamayı Başlatın (Geliştirme Modu):**
    ```bash
    npm run dev
    ```

4.  **Derleme (Production Build):**
    Uygulamayı paketlemek için:
    ```bash
    npm run build
    ```
    Çıktı dosyaları `dist-electron` dizininde oluşturulacaktır.

## 📖 Kullanım

### 1. Başlangıç
Uygulamayı açtığınızda iki ana seçenek sunulur:
*   **Excel'den Kişi Seç:** Toplu gönderim için önerilen mod. Bir Excel listesindeki kişilere mesaj atmak için kullanın.
*   **Web'den Kişi Seç:** WhatsApp rehberinizden veya gruplarınızdan manuel seçim yapmak için kullanın.

### 2. WhatsApp Girişi
Seçim yaptıktan sonra karşınıza çıkan QR kodu WhatsApp mobil uygulamanızdan (Ayarlar > Bağlı Cihazlar > Cihaz Bağla) taratın.

### 3. Kişi Seçimi ve Eşleştirme
*   **Excel Modunda:** Yüklediğiniz dosyadaki numaralar taranır ve rehberinizle eşleştirilir. Eşleşmeyenler "Hatalar" sekmesinde gösterilir ve manuel olarak düzeltilebilir.
*   **Filtreleme:** Kişilerim, Gruplar veya Tümü sekmeleriyle listeyi filtreleyebilirsiniz.

### 4. Mesaj Oluşturma
*   Şablon düzenleyiciyi kullanarak mesajınızı yazın.
*   `{isim}` butonuna tıklayarak kişi ismini, diğer butonlarla Excel sütunlarını mesajınıza ekleyin.
*   Önizleme panelinden mesajın nasıl görüneceğini kontrol edin.

### 5. Gönderim
*   Mesajı yazıp gönder butonuna bastıktan sonra mesajlar sırayla alıcılara iletilir.
*   İlerleme ekranından gönderim durumunu anlık olarak takip edin.

## 🏗️ Teknolojiler

*   **Electron:** Masaüstü uygulama çatısı.
*   **React:** Kullanıcı arayüzü kütüphanesi.
*   **Vite:** Hızlı geliştirme ve derleme aracı.
*   **WhatsApp Web.js:** WhatsApp otomasyon kütüphanesi.
*   **Tailwind CSS (veya özel CSS):** Stil ve tasarım.
*   **XLSX:** Excel dosyası işleme.

## ⚠️ Yasal Uyarı

Bu proje eğitim ve kişisel kullanım amaçlıdır. WhatsApp'ın hizmet koşullarına aykırı toplu mesaj gönderimi (spam) yapmak hesabınızın yasaklanmasına neden olabilir. Kullanım sorumluluğu tamamen kullanıcıya aittir.

---
Geliştirici: [chrwx4coffee](https://github.com/chrwx4coffee)
