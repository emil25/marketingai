// Vercel serverless function — proxies requests to the Anthropic API.
// The API key lives in the ANTHROPIC_API_KEY environment variable (never in the browser).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: { message: "Missing ANTHROPIC_API_KEY environment variable on Vercel." },
    });
  }

  const { system, messages, max_tokens } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: "Invalid request body." } });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: Math.min(Number(max_tokens) || 1000, 2000),
        system: String(system || "").slice(0, 8000),
        messages,
      }),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: { message: "Upstream error: " + err.message } });
  }
}
