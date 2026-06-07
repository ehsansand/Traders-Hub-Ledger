# 🚀 راهنمای جامع استقرار در کلادفلر پیجز (Cloudflare Pages Deployment Guide)

خبر فوق‌العاده! پروژه شما به گونه‌ای طراحی شده است که **نیازی به هاست مجزای بک‌اند (مانند Render یا Railway) ندارد**. 
با استفاده از قابلیت **Cloudflare Pages Functions**، کدهای بک‌اند هوش مصنوعی درون پوشه `/functions` و فرانت‌اند درون پوشه `src` به طور همزمان و کاملاً رایگان درون شبکه جهانی کلادفلر مستقر و اجرا می‌شوند.

---

## 💻 بخش اول: آپلود یا بروزرسانی پروژه در گیت‌هاب (Pushing to GitHub)

برای ارسال کدهای اصلاح‌شده به گیت‌هاب، مراحل زیر را در ترمینال روت پروژه انجام دهید:

1. وارد حساب کاربری خود در [GitHub](https://github.com) شده و یک ریپازیتوری خالی بسازید (ترجیحاً Private).
2. دستورات زیر را وارد کنید تا کدهای شما به گیت‌هاب فرستاده شوند:

```bash
# مقداردهی اولیه گیت (اگر از قبل انجام نداده‌اید)
git init

# ثبت همه تغییرات (فایل نامبروان wrangler.jsonc و پوشه functions نیز اضافه می‌شوند)
git add .

# ایجاد کامیت جدید
git commit -m "Configure high-performance Cloudflare Pages Functions and update wrangler config"

# تنظیم برنچ اصلی
git branch -M main

# اتصال به ریپازیتوری شما (اگر قبلاً متصل نکرده‌اید)
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPO_NAME.git

# پوش کردن تغییرات به برنچ اصلی
git push -u origin main
```

---

## 🌐 بخش دوم: راه‌اندازی و استقرار در Cloudflare Pages

حالا کافیست کلادفلر را به ریپازیتوری خود متصل کنید:

1. وارد پنل کاربری خود در [Cloudflare](https://dash.cloudflare.com) شوید.
2. از منوی سمت چپ به بخش **Workers & Pages** بروید.
3. روی دکمه‌ی **Create** کلیک کرده و تب **Pages** را انتخاب کنید. سپس روی **Connect to Git** بزنید.
4. ریپازیتوری گیت‌هاب جدید خود را انتخاب نمایید.
5. در بخش تنظیمات بیلد (**Build settings**)، موارد زیر را دقیقاً تنظیم فرمایید:
    *   **Project Name:** مقدار `traders-hub-ledger` (همانطور که در فایل `wrangler.jsonc` نوشته‌ایم).
    *   **Production branch:** مقدار `main`
    *   **Framework Preset:** گزینه **Vite** را انتخاب کنید (اگر نبود، روی `None` بگذارید).
    *   **Build command:** مقدار `npm run build`
    *   **Build output directory:** مقدار `dist`
    *   **Compatibility date:** مقدار `2024-01-01`
6. **تنظیم کلید هوش مصنوعی (بسیار مهم):**
    *   در همان صفحه یا بعد از ساخت پروژه به تب **Settings** > **Environment variables** بروید.
    *   یک متغیر محیطی (Environment Variable) جدید تحت عنوان زیر بسازید:
        *   **Variable Name (نام متغیر):** `GEMINI_API_KEY`
        *   **Value (مقدار):** کلید API هوش مصنوعی خود را در آن وارد کنید.
    *   *نکته:* متغیر `VITE_API_URL` را خالی بگذارید تا فرانت‌اند به طور خودکار به سرورلس‌های داخلی خودِ کلادفلر متصل شود.
7. روی دکمه‌ی **Save and Deploy** کلیک فرمایید. کلادفلر در کمتر از ۲ دقیقه کل پروژه را بیلد و آدرس اختصاصی شما را با فرمت زیر تحویل می‌دهد:
    `https://traders-hub-ledger.pages.dev`

---

## 🔒 بخش سوم: حل مشکل لاگین گوگل در فایربیس (Firebase Authorized Domains)

اگر از ورود به سیستم با گوگل فایربیس استفاده می‌کنید، برای رفع خطاهای احراز هویت دامین:

1. به [Firebase Console](https://console.firebase.google.com) پروژه خود بروید.
2. از منوی چپ به بخش **Authentication** رفته و تب **Settings** را باز کنید.
3. در کادر زیرین روی **Authorized domains** کلیک فرمایید.
4. دکمه‌ی **Add domain** را بزنید و دامنه‌ی کلادفلر خود را بدون `https://` اضافه کنید:
    *   به عنوان مثال: `traders-hub-ledger.pages.dev`
5. همچنین مطمئن شوید که این آدرس را به لیست مجاز ورود در تنظیمات شناسه‌های Google Cloud Console نیز اضافه کرده‌اید.

---

# 🚀 English Summary: Steps to Deploy

1. **Commit and Push to GitHub**:
   Ensure `wrangler.jsonc` has `"name": "traders-hub-ledger"` and the `/functions` directory is included in your commit. Run:
   ```bash
   git add .
   git commit -m "Deploy serverless backend & single CF Pages setup"
   git push
   ```
2. **Setup Cloudflare Pages**:
   - Go to Cloudflare Dashboard -> **Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**.
   - Input **Project Name** as `traders-hub-ledger`.
   - **Framework Preset**: `Vite` (Build command: `npm run build`, Output directory: `dist`).
3. **Configure API Secrets**:
   - In Cloudflare Pages Project -> **Settings** -> **Environment variables**.
   - Add variable: `GEMINI_API_KEY` with your API token as value.
   - Leave `VITE_API_URL` empty, it will auto-resolve locally on the same domain.
4. **Firebase Setup**:
   - Add your `.pages.dev` custom domain to **Authorized Domains** in your **Firebase Console under Authentication -> Settings**.
