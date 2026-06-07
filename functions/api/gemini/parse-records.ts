export async function onRequestPost({ request, env }: { request: Request; env: any }) {
  try {
    const { dataText } = await request.json().catch(() => ({ dataText: "" }));
    if (!dataText || typeof dataText !== "string") {
      return new Response(JSON.stringify({ error: "محتوای متنی ارسال شده معتبر نیست." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      // Smart offline fallback on the server side to protect user deployments against missing keys
      const parsed = serverlessOfflineParseRecords(dataText);
      return new Response(JSON.stringify(parsed), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const systemInstruction = `You are "Traders Hub AI Record Processor". You are an expert financial ledger data parser.
The user will provide you with unstructured text containing transaction records, which could be copy-pasted tables, Excel row grids, CSV-like text, list logs, bank SMS descriptions, or notes.
Your task is to parse all entries and extract as many valid Rial Entries and Crypto Entries as you can find.

Definitions & Conversions:
1. Target Gregorian Date (format: YYYY-MM-DD):
   - You MUST convert any Persian/Jalali dates (e.g. 1403/02/15) to correct Gregorian date. (Note: 1403/XX/XX roughly corresponds to 2024, 1404 corresponds to 2025, and 1405 corresponds to 2026).
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
   - "notes": Extra descriptive info or metadata.

Analyze the raw lines or tabular columns carefully. Mixed English and Persian is expected. Extract as many transactions as possible. Provide results strictly in the specified JSON schema. If nothing is found, return empty arrays.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: dataText }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              rialEntries: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    date: { type: "STRING", description: "Gregorian date in YYYY-MM-DD format." },
                    receivedFrom: { type: "STRING", description: "Sender name or party name." },
                    amount: { type: "NUMBER", description: "Pure numeric value in Tomans." },
                    bankName: { type: "STRING", description: "Destination bank name." },
                    notes: { type: "STRING", description: "Extra notes." },
                    type: { type: "STRING", description: "Transaction type: in or out." }
                  },
                  required: ["date", "receivedFrom", "amount", "bankName"]
                }
              },
              cryptoEntries: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    date: { type: "STRING", description: "Gregorian date in YYYY-MM-DD format." },
                    coinName: { type: "STRING", description: "Uppercase crypto symbol (e.g. USDT)." },
                    amount: { type: "NUMBER", description: "Pure decimal numeric coin amount." },
                    coinPrice: { type: "NUMBER", description: "Unit coin price in USD." },
                    equivalentUsd: { type: "NUMBER", description: "Total value in USD." },
                    walletAddress: { type: "STRING", description: "Wallet address." },
                    network: { type: "STRING", description: "Blockchain network (e.g. TRC-20)." },
                    type: { type: "STRING", description: "Transaction type: in or out." },
                    txHash: { type: "STRING", description: "Tx hash if present." },
                    notes: { type: "STRING", description: "Extra notes." }
                  },
                  required: ["date", "coinName", "amount", "type"]
                }
              }
            },
            required: ["rialEntries", "cryptoEntries"]
          }
        }
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ error: `Gemini API reported error: ${errorText}` }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const resData: any = await apiResponse.json();
    const answerText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsedData = JSON.parse(answerText);

    return new Response(JSON.stringify(parsedData), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Internal Server Error in Gemini Function" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

function serverlessOfflineParseRecords(text: string) {
  const rialEntries: any[] = [];
  const cryptoEntries: any[] = [];

  const faToEnNumbers = (str: string) => {
    if (!str) return "";
    const p = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
    let res = str;
    for (let i = 0; i < 10; i++) res = res.replace(p[i], String(i));
    return res;
  };

  const lines = text.split(/\r?\n/);
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (!line || line.length < 5) continue;
    const norm = faToEnNumbers(line).toLowerCase();

    const isCrypto = /usdt|tether|btc|bitcoin|eth|ethereum|ton|sol|trx|doge|تتر/i.test(norm);
    if (isCrypto) {
      let coinName = "USDT";
      if (/btc|bitcoin/i.test(norm)) coinName = "BTC";
      else if (/eth|ethereum/i.test(norm)) coinName = "ETH";
      else if (/ton/i.test(norm)) coinName = "TON";
      else if (/sol/i.test(norm)) coinName = "SOL";
      else if (/trx|tron/i.test(norm)) coinName = "TRX";

      const isOut = /برداشت|withdraw|transfer|انتقال|out|فروش/i.test(norm);
      let amount = 1.0;
      const numMatches = norm.match(/[0-9]+(?:\.[0-9]+)?/g);
      if (numMatches) {
        for (const nm of numMatches) {
          const v = parseFloat(nm);
          if (v && v !== 1403 && v !== 2026 && v < 10000) { amount = v; break; }
        }
      }

      let coinPrice = 1.0;
      if (coinName === "BTC") coinPrice = 68000;
      else if (coinName === "ETH") coinPrice = 3550;
      else if (coinName === "TON") coinPrice = 7.4;
      else if (coinName === "SOL") coinPrice = 160;

      cryptoEntries.push({
        date: new Date().toISOString().split("T")[0],
        coinName,
        amount,
        coinPrice,
        equivalentUsd: amount * coinPrice,
        walletAddress: "",
        network: "TRC-20",
        type: isOut ? "out" : "in",
        notes: line + " (پردازش آفلاین)"
      });
    } else {
      let amount = 0;
      const mil = norm.match(/(\d+(?:\.\d+)?)\s*(?:میلیون|mil|m)/);
      if (mil) {
        amount = parseFloat(mil[1]) * 1000000;
      } else {
        const numbers = norm.match(/\d+/g) || [];
        for (const num of numbers) {
          const v = parseInt(num, 10);
          if (v > 1000) { amount = v; break; }
        }
      }

      if (amount === 0) continue;

      let bankName = "بانک ملت";
      if (/سامان/i.test(norm)) bankName = "بانک سامان";
      else if (/ملی/i.test(norm)) bankName = "بانک ملی";
      else if (/پاسارگاد/i.test(norm)) bankName = "بانک پاسارگاد";

      const isOut = /پرداخت|برداشت|انتقال|خرید|out/i.test(norm);

      let receivedFrom = "نامشخص";
      const words = line.split(/[\s,،؛]+/).filter(w => {
        const cleanW = faToEnNumbers(w).replace(/[^a-zA-Zآ-ی0-9]/g, "");
        return cleanW.length > 1 && !/^[0-9]+$/.test(cleanW) && !/تومان|ریال|میلیون|هزار|بانک|واریز|پرداخت|برداشت/.test(cleanW);
      });
      if (words.length > 0) {
        receivedFrom = words.slice(0, 2).join(' ');
      }

      rialEntries.push({
        date: new Date().toISOString().split("T")[0],
        receivedFrom,
        amount,
        bankName,
        type: isOut ? "out" : "in",
        notes: line + " (پردازش آفلاین)"
      });
    }
  }
  return { rialEntries, cryptoEntries };
}

