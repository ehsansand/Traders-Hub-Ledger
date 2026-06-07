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

    const { question, rialEntries = [], cryptoEntries = [], language = "fa" } = await request.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "سوال ارسال شده معتبر نیست." }), { status: 400, headers: { "Content-Type": "application/json" } });
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
