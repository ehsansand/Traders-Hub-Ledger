export async function onRequestPost({ request, env }: { request: Request; env: any }) {
  try {
    const { question, rialEntries = [], cryptoEntries = [], language = "fa" } = await request.json().catch(() => ({}));
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "سوال ارسال شده معتبر نیست." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      // Smart offline calculation fallback
      const answer = serverlessOfflineQueryLedger(question, rialEntries, cryptoEntries, language);
      return new Response(JSON.stringify({ answer }), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

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
6. Return your answer in highly-readable Markdown format. Use bullet points, bold totals, and clean tables for multiple entries.
7. If no entries match, explain that politely and suggest what keywords the user might search next.
8. Be concise, extremely helpful, and professional. Avoid conversational fluff.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: question }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.2
        }
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ error: `Gemini API reported error: ${errorText}` }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const resData: any = await apiResponse.json();
    const answer = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ answer }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Internal Server Error in Gemini Function" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

function serverlessOfflineQueryLedger(
  question: string,
  rialEntries: any[] = [],
  cryptoEntries: any[] = [],
  language: string = "fa"
): string {
  const qLower = question.toLowerCase();
  const isFa = language === "fa";

  const rialIn = rialEntries.filter(r => r.type !== 'out');
  const rialOut = rialEntries.filter(r => r.type === 'out');
  const sumRialIn = rialIn.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const sumRialOut = rialOut.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const cryptoIn = cryptoEntries.filter(c => c.type !== 'out');
  const cryptoOut = cryptoEntries.filter(c => c.type === 'out');
  const sumCryptoValueIn = cryptoIn.reduce((sum, c) => sum + (Number(c.equivalentUsd) || 0), 0);
  const sumCryptoValueOut = cryptoOut.reduce((sum, c) => sum + (Number(c.equivalentUsd) || 0), 0);

  const coinSums: { [coin: string]: { amountIn: number; amountOut: number } } = {};
  cryptoEntries.forEach(c => {
    const coin = (c.coinName || 'USDT').toUpperCase();
    if (!coinSums[coin]) {
      coinSums[coin] = { amountIn: 0, amountOut: 0 };
    }
    const val = Number(c.amount) || 0;
    if (c.type === 'out') {
      coinSums[coin].amountOut += val;
    } else {
      coinSums[coin].amountIn += val;
    }
  });

  const fToman = (val: number) => {
    return isFa ? `${val.toLocaleString('fa-IR')} تومان` : `${val.toLocaleString()} Tomans`;
  };
  const fUsd = (val: number) => {
    return isFa ? `${val.toLocaleString('fa-IR')} دلار (USD)` : `$${val.toLocaleString()}`;
  };

  if (/خلاصه|کل حساب|گزارش|حساب کتاب|audit|summary|report|آمار|جمع/i.test(qLower)) {
    if (isFa) {
      return `### 📊 گزارش محاسباتی لجر (آفلاین - سرورلس)

این گزارش به صورت خودکار و آفلاین توسط سرور ابری کلادفلر بدون به کارگیری توکن Gemini تولید شده است:

#### **۱. حوزه ریالی (Toman)**
* **بخش ورودی‌ها:** **${fToman(sumRialIn)}** (${rialIn.length} تراکنش)
* **بخش خروجی‌ها:** **${fToman(sumRialOut)}** (${rialOut.length} تراکنش)
* **تراز صندوق فرعی:** **${fToman(sumRialIn - sumRialOut)}**

#### **۲. حوزه ارزی (Crypto)**
* **ارزش کل واریزی کلاینت:** **${fUsd(sumCryptoValueIn)}** (${cryptoIn.length} مورد)
* **ارزش کل برداشت کلاینت:** **${fUsd(sumCryptoValueOut)}** (${cryptoOut.length} مورد)
* **تراز معادل تتر:** **${fUsd(sumCryptoValueIn - sumCryptoValueOut)}**

#### **۳. دارایی‌های تجمعی در کیف پول:**
${Object.keys(coinSums).length > 0 
  ? Object.entries(coinSums).map(([coin, v]) => `* **${coin}**: واریزی \`${v.amountIn.toLocaleString()}\` | برداشتی \`${v.amountOut.toLocaleString()}\` | موجودی خالص: **\`${(v.amountIn - v.amountOut).toLocaleString()}\` ${coin}**`).join('\n')
  : '*فاقد تراکنش ارز دیجیتال ثبت شده*'
}`;
    } else {
      return `### 📊 Real-time Audit Ledger Report (Serverless-Offline)

This audit is processed on-the-fly without an active external Gemini AI key to assure privacy:

#### **1. Fiat Section (Toman)**
* **Total incoming logs:** **${fToman(sumRialIn)}** (${rialIn.length} txns)
* **Total outgoing logs:** **${fToman(sumRialOut)}** (${rialOut.length} txns)
* **Fiat Net Balance:** **${fToman(sumRialIn - sumRialOut)}**

#### **2. Cryptocurrency Assets**
* **Total Incoming Valuation:** **${fUsd(sumCryptoValueIn)}**
* **Total Outgoing Valuation:** **${fUsd(sumCryptoValueOut)}**
* **Crypto Net Balance:** **${fUsd(sumCryptoValueIn - sumCryptoValueOut)}**
`;
    }
  }

  // Check simple name find
  const namesInDb = Array.from(new Set(rialEntries.map(r => r.receivedFrom || 'نامشخص'))).filter(n => n !== 'نامشخص');
  let matchedPerson: string | null = null;
  for (const name of namesInDb) {
    if (qLower.includes(name.toLowerCase())) {
      matchedPerson = name;
      break;
    }
  }

  if (matchedPerson) {
    const personTransactions = rialEntries.filter(r => (r.receivedFrom || '').toLowerCase().includes(matchedPerson!.toLowerCase()));
    if (personTransactions.length > 0) {
      const pin = personTransactions.filter(r => r.type !== 'out');
      const pout = personTransactions.filter(r => r.type === 'out');
      const sIn = pin.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const sOut = pout.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      if (isFa) {
        return `### 👤 گردش حساب طرف حساب: **${matchedPerson}**

تعدادی معادل **${personTransactions.length} ردیف معامله** با **${matchedPerson}** ثبت شده است:

* **کل دریافتی از ایشان:** ${fToman(sIn)}
* **کل پرداختی به ایشان:** ${fToman(sOut)}
* **مانده نهایی:** **${fToman(sIn - sOut)}**

| تاریخ | بانک مقصد | نوع | مبلغ (تومان) | توضیحات |
|:---:|:---:|:---:|:---:|:---|
${personTransactions.map(r => `| \`${r.date}\` | ${r.bankName} | ${r.type === 'out' ? '🔴 خروجی' : '🟢 ورودی'} | **${Number(r.amount).toLocaleString('fa-IR')}** | ${r.notes || '-'} |`).join('\n')}
`;
      } else {
        return `### 👤 Ledger Records for: **${matchedPerson}**

Found **${personTransactions.length} rows** relating to **${matchedPerson}**:

* **Total inputs:** ${fToman(sIn)}
* **Total outputs:** ${fToman(sOut)}
* **Net balance:** **${fToman(sIn - sOut)}**
`;
      }
    }
  }

  // Local default message
  if (isFa) {
    return `دستیار مالی هوش مصنوعی هوشمند آماده پاسخ‌دهی به تمام سوالات محاسباتی شما به صورت کاملاً آفلاین و سریع است.
شما می‌توانید بپرسید:
- "یک گزارش از تراز کل حساب‌ها بده"
- "گردش حساب مریم" یا "حساب سعید"
- "موجودی تتر من چقدر است؟"`;
  } else {
    return `AI Assistant runs locally and fast. Try asking for:
- "give me a report of all accounts"
- "statement for client name"`;
  }
}

