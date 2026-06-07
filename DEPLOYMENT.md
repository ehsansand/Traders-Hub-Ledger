# 🚀 راهنمای جامع تولیدی کردن و استقرار برنامه (Deployment & Production Guide)

این پروژه برای دفتر کل حسابداری مدرن و اتومات تریدرز هاب پرو (**Traders Hub Ledger PRO**) بهینه شده و آماده‌ی آپلود در ریپازیتوری **GitHub** و استقرار (Deploy) روی **Cloudflare Pages** (یا هر سرویس استاتیک مشابهی مانند GitHub Pages و Vercel) می‌باشد.

---

## 💻 بخش اول: آپلود پروژه در گیت‌هاب (Pushing to GitHub)

برای ارسال کدهای خود به گیت‌هاب، مراحل استاندارد زیر را دنبال کنید:

1. وارد حساب کاربر خود در [GitHub](https://github.com) شده و یک ریپازیتوری خالی جدید (ترجیحاً Private جهت امنیت اطلاعات فایربیس و کانفیگ‌ها) بسازید.
2. ترمینال خود را در روت پروژه باز کنید و دستورات زیر را وارد نمایید:

```bash
# مقداردهی اولیه گیت
git init

# اضافه کردن تمام فایل‌ها به گیت (مسیر فایل‌های حساس در gitignore. مسدود است)
git add .

# ایجاد کامیت اولیه با پیام مناسب
git commit -m "Initialize Traders Hub Ledger with Auto-Device Detection and Cloudflare-compatible dynamic endpoints"

# اتصال به برنچ پیش‌فرض اصلی
git branch -M main

# اتصال ریپازیتوری لوکال شما به گیت‌هاب (آدرس به جای URL فرضی شما قرار گیرد)
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPO_NAME.git

# پوش کردن کدها به ریپازیتوری گیت‌هاب
git push -u origin main
```

---

## 🌐 بخش دوم: معماری استقرار دوگانه (Dual-Deployment Architecture)

از آنجایی که برنامه حاوی هوش محاسباتی **Gemini** است که کلیدهای API آن به دلایل امنیت نباید در مروگر افشا شوند، برنامه از معماری فول‌استک سرور + کلاینت استفاده می‌کند:
*   **کلاینت (Frontend):** کدهای React که فایل‌های استاتیک آن را روی **Cloudflare Pages** یا **GitHub Pages** میزبانی می‌کنید.
*   **سرور (Backend):** کدهای Express سرور (`server.ts`) که آن را روی یک هاست کانتینری مانند **Cloud Run**، **Render**، **Railway** یا **Fly.io** میزبانی می‌کنید.

---

### ۱. استقرار فرانت‌اند در کلادفلر (Deploying Frontend on Cloudflare Pages)

کلادفلر پورتال فوق‌العاده سریع و رایگانی برای فایل‌های استاتیک Vite فراهم می‌کند. برای بالا آوردن فرانت‌اند:

1. وارد پنل اختصاصی **Cloudflare** شده و به بخش **Pages** (یا Workers & Pages) بروید.
2. روی دکمه‌ی **Connect to Git** کلیک کنید و ریپازیتوری گیت‌هاب این پروژه را انتخاب نمایید.
3. در کادرهای پیکربندی بیلد موارد زیر را وارد کنید:
    *   **Framework Preset:** گزینه `Vite` یا `None` را انتخاب کنید.
    *   **Build Command:** دستور `npm run build` را قرار دهید.
    *   **Build Output Directory:** پوشه `dist` را قرار دهید.
4. در بخش کانفیگ دکمه‌ی متغیرهای محیطی (**Environment Variables**)، متغیر زیر را اضافه کنید تا فرانت‌اند بداند درخواست‌های هوش مصنوعی را به کدام آدرس ارسال کند:
    *   مقدار کلیدی: `VITE_API_URL`
    *   مقدار عددی: آدرس دامنه‌ی سرور بک‌اند شما (مثال: `https://tradershub-api.onrender.com`)
5. روی دکمه‌ی **Save and Deploy** کلیک کنید. کلادفلر فوراً برنامه را کامپایل کرده و دامنه‌ای با فرمت زیر به شما تقدیم می‌کند:
    `https://YOUR_APP.pages.dev`

---

### ۲. استقرار بک‌اند (Deploying Backend Container)

برای اینکه تحلیلگر هوش مصنوعی Gemini و رادار واریزی شما بدون مشکل کار کنند، فایل `server.ts` را روی یکی از هاست‌های بک‌اند ابری بالا بیاورید:

#### راهکار اول: Render.com (بسیار ساده و رایگان)
1. در پنل [Render](https://render.com) یک **Web Service** از اتصال گیت‌هاب بسازید.
2. فیلدهای بیلد و اجرا را مقداردهی نمایید:
    *   **Runtime:** گزینه `Node`
    *   **Build Command:** دستور `npm install && npm run build`
    *   **Start Command:** دستور `npm start`
3. در تب **Environment Variables**، مقدار زیر را تنظیم کنید:
    *   `GEMINI_API_KEY`: مقدار توکن امنیتی دریافتی شما از گوگل ای‌آی استودیو.

---

## 🔒 بخش سوم: حل دائمی مشکلات لاگین گوگل (Firebase Domain Authorization)

یکی از رایج‌ترین علت‌های از کار افتادن ورود امن با گوگل در محیط‌های توزیع شده، مسدود شدن دامنه توسط دیوار امنیتی فایربیس (Firebase OAuth Safe List) است. برای رفع فوری این مشکل:

1. به [Firebase Console](https://console.firebase.google.com) پروژه خود مراجعه فرمایید.
2. از منوی سمت چپ به بخش **Authentication** وارد شده و تب **Settings** را باز کنید.
3. در منوی فرعی روی منوی **Authorized domains** کلیک نمایید.
4. دکمه‌ی **Add domain** را بزنید و آدرس دامنه‌ی کلادفلر فرانت‌اند خود را اضافه نمایید:
    *   مثال: `YOUR_APP.pages.dev` (بدون `https://` و اسلش پایانی).
5. همچنین مطمئن شوید در بخش تنظیمات **Google Cloud Console** در تب Credentials، این دامنه‌ها را به لیست مجاز ورود اضافه کرده‌اید.

---

# 🚀 English: Production Deployment Guide

## 💻 1. Push to GitHub
1. Create a new private reservoir repository on [GitHub](https://github.com).
2. Execute the following CLI commands inside your workspace directory:
```bash
git init
git add .
git commit -m "Configure production builds and automatic device selectors"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPO_NAME.git
git push -u origin main
```

## 🌐 2. Hosting Configuration

### 🚀 Static Frontend (Cloudflare Pages)
- **Framework Preset**: `Vite` (or build static html options)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: Add `VITE_API_URL` pointing to your deployed backend domain (e.g. `https://tradershub-backend.onrender.com`).

### 📦 Server Backend (Render, Railway, or Google Cloud Run)
- **Engine**: Node.js CJS/ESM
- **Build Scripts**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**: Provide `GEMINI_API_KEY` under backend secrets to execute analysis calls safely.

### 🔒 3. Fix Google Auth Domain Failures
To prevent unauthorized redirect issues, always remember to add your production Cloudflare App domain (e.g., `YOUR_APP.pages.dev`) directly inside the **Authorized Domains** list of your **Firebase Console under Authentication -> Settings**.
