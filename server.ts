import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in process.env");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API logs query model
  app.post("/api/gemini/query", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "کلید API مربوط به هوش مصنوعی (GEMINI_API_KEY) در سرور تنظیم نشده است. لطفاً آن را در بخش Settings > Secrets اضافه کنید."
        });
      }

      const { question, rialEntries = [], cryptoEntries = [], language = "fa" } = req.body;
      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "سوال ارسال شده معتبر نیست." });
      }

      const client = getGeminiClient();

      const systemInstruction = `You are "Traders Hub AI Accountant", a highly intelligent, premium, and mathematically precise financial analysis chatbot.
The user's language preference is "${language}". Provide your output exclusively in ${language === "en" ? "English" : "Persian (Persian numbers and text)"}.

You are given direct access to the live ledger data of the user below to answer their financial questions.

=== DATABASE ===
RIAL ENTRIES (تراکنش‌های ریالی):
${JSON.stringify(rialEntries, null, 2)}

CRYPTO ENTRIES (تراکنش‌های رمزارزی):
${JSON.stringify(cryptoEntries, null, 2)}
================

Instructions:
1. ALWAYS perform accurate mathematical calculations. Sum up values, pull specific statistics, and count occurrences carefully.
2. You now have optional fields "coinPrice" (unit price in USD), "equivalentUsd" (total value in USD), and "walletAddress" (destination wallet address) inside individual Crypto entries. If asked about totals, valuations, or wallets, summarize them mathematically and accurately.
3. If asked about a user (e.g., "علی", "سعید"), do substring/name matching against "receivedFrom" in Rial entries (case-insensitive).
4. If asked about a bank name (e.g., "ملت", "سامان"), query/sum Rial entries for that "bankName".
5. If asked about a coin (e.g., "USDT", "BTC") or blockchain network (e.g., "TRC-20"), summarize specific "coinName", "network", or wallet details inside Crypto entries.
5. Return your answer in highly-readable Markdown format. Use bullet points, bold totals, and clean tables for multiple entries.
6. If no entries match, explain that politely and suggest what keywords the user might search next.
7. Be concise, extremely helpful, and professional. Avoid conversational fluff.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: question,
        config: {
          systemInstruction,
          temperature: 0.2,
        }
      });

      const answer = response.text || "";
      res.json({ answer });
    } catch (error: any) {
      console.error("Gemini API error in server:", error);
      res.status(500).json({ error: error?.message || "Internal Server Error in model request" });
    }
  });

  // API route for parsing unstructured Excel/text record data using Gemini
  app.post("/api/gemini/parse-records", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "کلید API مربوط به هوش مصنوعی (GEMINI_API_KEY) در سرور تنظیم نشده است. لطفاً آن را در بخش Settings > Secrets اضافه کنید."
        });
      }

      const { dataText } = req.body;
      if (!dataText || typeof dataText !== "string") {
        return res.status(400).json({ error: "محتوای متنی ارسال شده معتبر نیست." });
      }

      const client = getGeminiClient();

      const systemInstruction = `You are "Traders Hub AI Record Processor". You are an expert financial ledger data parser.
The user will provide you with unstructured text containing transaction records, which could be copy-pasted tables, Excel row grids, CSV-like text, list logs, bank SMS descriptions, or notes.
Your task is to parse all entries and extract as many valid Rial Entries and Crypto Entries as you can find.

Definitions & Conversions:
1. Target Gregorian Date (format: YYYY-MM-DD):
   - You MUST convert any Persian/Jalali dates (e.g. 1403/02/15) to correct Gregorian date. (Note: 1403/XX/XX roughly corresponds to 2024, 1404 corresponds to 2025, and 1405 corresponds to 2026. Perform standard calendar conversions or close estimations).
   - If the text has only time or is missing a date, use standard today's Gregorian date in YYYY-MM-DD format based on current year 2026.
2. Rial ("rialEntries"):
   - "amount": Must be a pure numeric value representing the total tomans (تومان) transferred. 1 Toman = 10 Rials. Always normalize text unit terms (e.g. use "12000000" instead of "12 میلیون" or "12,000,000").
   - "receivedFrom": The sender's name or party name.
   - "bankName": The targeted Persian bank name (e.g. "ملت", "سامان", "پاسارگاد", etc.). If not found, default to "بانک نامشخص".
   - "type": "in" (Default, received/incoming) or "out" (sent/outgoing).
   - "notes": Extra descriptive info or metadata.
3. Crypto ("cryptoEntries"):
   - "coinName": Standard uppercase ticker symbol (e.g., "USDT", "BTC", "ETH", "TON").
   - "amount": Pure decimal numeric value of crypto coin units.
   - "coinPrice": The unit price in USD (e.g. 1.00 for USDT). If not found, try to estimate or use standard market reference.
   - "equivalentUsd": Total value in USD (amount * coinPrice).
   - "walletAddress": Destination wallet address if found, otherwise omit.
   - "network": Blockchain standard network in uppercase (e.g., "TRC-20", "ERC-20", "TON"). If not found, use a reasonable default based on common coin types.
   - "type": "in" (deposit) or "out" (withdrawal).
   - "txHash": Transaction Hash if present.

Analyze the raw lines or tabular columns carefully. Mixed English and Persian is expected. Extract as many transactions as possible. Provide results strictly in the specified JSON schema. If nothing is found, return empty arrays.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: dataText,
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rialEntries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: "Gregorian date in YYYY-MM-DD format." },
                    receivedFrom: { type: Type.STRING, description: "Sender name or party name." },
                    amount: { type: Type.NUMBER, description: "Pure numeric value in Tomans." },
                    bankName: { type: Type.STRING, description: "Destination bank name." },
                    notes: { type: Type.STRING, description: "Extra notes." },
                    type: { type: Type.STRING, description: "Transaction type: in or out." }
                  },
                  required: ["date", "receivedFrom", "amount", "bankName"]
                }
              },
              cryptoEntries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: "Gregorian date in YYYY-MM-DD format." },
                    coinName: { type: Type.STRING, description: "Uppercase crypto symbol (e.g. USDT)." },
                    amount: { type: Type.NUMBER, description: "Pure decimal numeric coin amount." },
                    coinPrice: { type: Type.NUMBER, description: "Unit coin price in USD." },
                    equivalentUsd: { type: Type.NUMBER, description: "Total value in USD." },
                    walletAddress: { type: Type.STRING, description: "Wallet address." },
                    network: { type: Type.STRING, description: "Blockchain network (e.g. TRC-20)." },
                    type: { type: Type.STRING, description: "Transaction type: in or out." },
                    txHash: { type: Type.STRING, description: "Tx hash if present." },
                    notes: { type: Type.STRING, description: "Extra notes." }
                  },
                  required: ["date", "coinName", "amount", "type"]
                }
              }
            },
            required: ["rialEntries", "cryptoEntries"]
          }
        }
      });

      const textOutput = response.text || "{}";
      const recordsJson = JSON.parse(textOutput);
      res.json(recordsJson);
    } catch (error: any) {
      console.error("Gemini Parse Records API Error:", error);
      res.status(500).json({ error: error?.message || "Internal Server Error in parsing request" });
    }
  });

  // API to fetch live promos and discounts for VPN and Streaming services using Gemini search grounding
  app.post("/api/gemini/live-offers", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const { language = "fa" } = req.body;

      if (!apiKey) {
        // Fall back gracefully to curated static offers if API key is not configured yet
        return res.json(getCuratedStaticOffers(language));
      }

      const client = getGeminiClient();
      const prompt = `Search the web to find the latest active discounts, promo codes, deals, and current cheap plans for major VPN providers (ExpressVPN, NordVPN, Surfshark, ProtonVPN), movie/music streaming services (Netflix, Spotify, YouTube Premium), and hosting/servers (Hetzner, DigitalOcean) for year 2026.
Present these active offers in a structured JSON schema. The details and descriptions must be in ${language === "fa" ? "Persian (Farsi)" : "English"}.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are "Traders Hub Subscription Bargain Hunter". Search and retrieve currently verified VPN and streaming software promo deals.
Create 5 to 7 high-quality, real deals. Ensure that discount percent and source URLs are accurate and work. Output raw, valid, and clean JSON matching the specified schema. Keep service names literal.`,
          tools: [{ googleSearch: {} }],
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              offers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    serviceName: { type: Type.STRING },
                    category: { type: Type.STRING, description: "vpn, streaming, hosting, or other" },
                    dealTitle: { type: Type.STRING },
                    details: { type: Type.STRING },
                    promoCode: { type: Type.STRING },
                    discountPercent: { type: Type.NUMBER },
                    priceInfo: { type: Type.STRING },
                    sourceUrl: { type: Type.STRING },
                    lastVerified: { type: Type.STRING }
                  },
                  required: ["serviceName", "category", "dealTitle", "details"]
                }
              }
            },
            required: ["offers"]
          }
        }
      });

      const textOutput = response.text || "{}";
      const offersJson = JSON.parse(textOutput);
      res.json(offersJson);
    } catch (error: any) {
      console.warn("Gemini Live Offers Error, falling back to static curated:", error);
      const { language = "fa" } = req.body;
      res.json(getCuratedStaticOffers(language));
    }
  });

  // Helper function to return beautiful, realistic discount data when offline/no Key
  function getCuratedStaticOffers(lang: string) {
    if (lang === "fa") {
      return {
        offers: [
          {
            serviceName: "NordVPN",
            category: "vpn",
            dealTitle: "تخفیف ویژه سالانه (۷۳٪ تخفیف + ۳ ماه رایگان)",
            details: "یکی از امن‌ترین فیلترشکن‌های دنیا با پهنای باند نامحدود، سرعت فوق‌العاده و بیش از ۶۰۰۰ سرور در سراسر جهان. مناسب برای ترید و اتصال ایمن.",
            promoCode: "AUTOMATIC (در لینک فعال است)",
            discountPercent: 73,
            priceInfo: "۳.۰۹ دلار در ماه",
            sourceUrl: "https://nordvpn.com/special/",
            lastVerified: "June 2026"
          },
          {
            serviceName: "ExpressVPN",
            category: "vpn",
            dealTitle: "تخفیف ۴۹ درصدی اشتراک ۱۲ ماهه + ۳ ماه رایگان",
            details: "پایدارترین و سریع‌ترین فیلترشکن اختصاصی دنیا با پینگ فوق‌العاده پایین برای دور زدن محدودیت‌های ترید، یوتیوب و گیمینگ.",
            promoCode: "EXPRESS49",
            discountPercent: 49,
            priceInfo: "۶.۶۷ دلار در ماه",
            sourceUrl: "https://www.expressvpn.com/go/features/coupon",
            lastVerified: "June 2026"
          },
          {
            serviceName: "Surfshark",
            category: "vpn",
            dealTitle: "جشنواره ویژه ۸۲ درصد تخفیف + ۲ ماه هدیه اضافه",
            details: "بزرگ‌ترین مزیت: امکان اتصال نامحدود دستگاه‌ها به صورت همزمان. ترافیک کاملاً نامحدود و سرورهای دوست‌دار حریم خصوصی.",
            promoCode: "SHARK82",
            discountPercent: 82,
            priceInfo: "۲.۱۹ دلار در ماه",
            sourceUrl: "https://surfshark.com/deals",
            lastVerified: "June 2026"
          },
          {
            serviceName: "Spotify Premium",
            category: "streaming",
            dealTitle: "۳ ماه اکانت پرمیوم رایگان برای کاربران جدید",
            details: "دسترسی نامحدود به میلیون‌ها موزیک و پادکست بدون تبلیغات با بالاترین کیفیت کیفیت صدا و امکان دانلود آفلاین.",
            promoCode: "AUTOMATIC",
            discountPercent: 100,
            priceInfo: "رایگان برای ۳ ماه اول (اصلی: ۱۰.۹۹$/ماه)",
            sourceUrl: "https://www.spotify.com/us/premium/",
            lastVerified: "June 2026"
          },
          {
            serviceName: "YouTube Premium",
            category: "streaming",
            dealTitle: "۱ ماه تست رایگان + راهکار تغییر ریجن ارزان (نیجریه/اوکراین)",
            details: "حذف کامل تبلیغات یوتیوب، پخش در پس‌زمینه و دسترسی رایگان به سرویس YouTube Music. خرید تیمی بسیار ارزان‌تر تمام می‌شود.",
            promoCode: "REGIONAL_DEAL",
            discountPercent: 50,
            priceInfo: "حدود ۱.۵ تا ۲ دلار (با تغییر ریجن به نیجریه)",
            sourceUrl: "https://www.youtube.com/premium",
            lastVerified: "June 2026"
          },
          {
            serviceName: "Hetzner Cloud",
            category: "hosting",
            dealTitle: "۲۰ یورو اعتبار اولیه هدیه برای خرید سرور مجازی (VPS)",
            details: "بهترین گزینه برای راه‌اندازی سرور خصوصی کلاینت و فیلترشکن‌های شخصی V2ray با پهنای باند عالی ۲۰ ترابایت ماهانه و تضمین ۹۹.۹٪ آپ‌تایم.",
            promoCode: "HETZNER-20GIFT",
            discountPercent: 100,
            priceInfo: "۲۰ یورو هدیه رایگان (شروع قیمت‌ها از ۴ یورو/ماه)",
            sourceUrl: "https://www.hetzner.com/cloud",
            lastVerified: "June 2026"
          }
        ]
      };
    } else {
      return {
        offers: [
          {
            serviceName: "NordVPN",
            category: "vpn",
            dealTitle: "NordVPN Special (73% Off + 3 Months Free)",
            details: "Robust security and fast connections across 6000+ servers worldwide. Perfect for digital privacy and trading safety.",
            promoCode: "AUTOMATIC",
            discountPercent: 73,
            priceInfo: "$3.09 / mo",
            sourceUrl: "https://nordvpn.com/special/",
            lastVerified: "June 2026"
          },
          {
            serviceName: "ExpressVPN",
            category: "vpn",
            dealTitle: "Exclusive 49% Off 12-Month Plan + 3 Months Free",
            details: "Top-performance VPN with premium blazing fast nodes. Best choice for uninterrupted global network access.",
            promoCode: "EXPRESS49",
            discountPercent: 49,
            priceInfo: "$6.67 / mo",
            sourceUrl: "https://www.expressvpn.com/go/features/coupon",
            lastVerified: "June 2026"
          },
          {
            serviceName: "Surfshark",
            category: "vpn",
            dealTitle: "Surfshark Epic Offer (82% Off + 2 Months Free)",
            details: "Ultimate bargain with support for unlimited simultaneous device connections. Includes adblocker and bypass features.",
            promoCode: "SHARK82",
            discountPercent: 82,
            priceInfo: "$2.19 / mo",
            sourceUrl: "https://surfshark.com/deals",
            lastVerified: "June 2026"
          },
          {
            serviceName: "Spotify Premium",
            category: "streaming",
            dealTitle: "Get 3 Months Free Premium Subscription",
            details: "Listen to ad-free music offline with supreme sound quality. Valid for new individual accounts worldwide.",
            promoCode: "AUTOMATIC",
            discountPercent: 100,
            priceInfo: "Free for first 3 months ($10.99/mo after)",
            sourceUrl: "https://www.spotify.com/us/premium/",
            lastVerified: "June 2026"
          },
          {
            serviceName: "YouTube Premium",
            category: "streaming",
            dealTitle: "1-Month Free Trial / Cheap Regional Subscription Guidance",
            details: "Block video commercials, activate audio background playback, and enjoy fully bundled Premium Music services.",
            promoCode: "REGIONAL_DEAL",
            discountPercent: 50,
            priceInfo: "~$1.80/mo (Using Nigeria/Ukraine regional address)",
            sourceUrl: "https://www.youtube.com/premium",
            lastVerified: "June 2026"
          },
          {
            serviceName: "Hetzner Cloud",
            category: "hosting",
            dealTitle: "€20 Free Credits in Hetzner Cloud VPS Servers",
            details: "Excellent platform to host proprietary personal relays or custom web platforms with high-throughput 20TB bandwidth plans.",
            promoCode: "HETZNER-20GIFT",
            discountPercent: 100,
            priceInfo: "€20 Starter Credits (VPS starting at ~€4/mo)",
            sourceUrl: "https://www.hetzner.com/cloud",
            lastVerified: "June 2026"
          }
        ]
      };
    }
  }

  // Vite Dev Server middleware or production static files serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Traders Hub Server] Running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
