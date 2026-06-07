export async function onRequestPost({ request, env }: { request: Request; env: any }) {
  try {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "کلید API مربوط به هوش مصنوعی (GEMINI_API_KEY) در سرور کلادفلر تنظیم نشده است. لطفاً آن را در بخش Settings > Environment Variables پنل Cloudflare اضافه کنید."
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { dataText } = await request.json();
    if (!dataText || typeof dataText !== "string") {
      return new Response(JSON.stringify({ error: "محتوای متنی ارسال شده معتبر نیست." }), { status: 400, headers: { "Content-Type": "application/json" } });
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
