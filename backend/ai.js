// ai.js - schema-guided extraction.
// Works with ANY OpenAI-compatible chat API (set AI_BASE_URL, AI_API_KEY, AI_MODEL).
// If no key is configured it falls back to a simple rule-based extractor so the
// app still runs end to end (clearly flagged as "fallback" in the response).

export function buildPrompt(text) {
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const system = `You are an intake assistant for a hospital front desk.
Convert the patient's or caregiver's message into an appointment request.
The message may be in English, Hindi, Punjabi or a mix; always output English values.

Return ONLY one JSON object, no markdown, with exactly these keys:
{
  "patient_name": string | null,
  "contact": string | null,            // phone number as written
  "reason": string | null,             // short English summary of the problem
  "preferred_date": string | null,     // YYYY-MM-DD
  "preferred_time": string | null,     // e.g. "morning", "10:30 AM"
  "department": "General" | "Cardiology" | "Pediatrics" | "Orthopedics" | "Other",
  "urgency": "routine" | "soon" | "urgent"
}

Rules:
- Today is ${today} (${weekday}). Resolve relative dates like "tomorrow" or "next Monday" using it.
- If a value is NOT stated in the message, use null. NEVER guess or invent a name, phone number or date.
- urgency "urgent" for emergencies (chest pain, breathing trouble, severe bleeding, unconsciousness, stroke signs);
  "soon" for pain/fever/worsening symptoms; otherwise "routine".
- Pick the department that best matches the symptoms; use "General" if unsure.
- You are NOT diagnosing. Do not add medical advice.`;
  return { system, user: `Message:\n"""${text}"""` };
}

export async function extractWithAI(text) {
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = process.env;
  if (!AI_API_KEY) return { raw: fallbackExtract(text), mode: "fallback" };

  const { system, user } = buildPrompt(text);
  const base = (AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

  // Try the configured model first, then backups (free tiers are often busy).
  const backups = (process.env.AI_FALLBACK_MODELS || "gemini-flash-lite-latest,gemini-flash-latest")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const models = [...new Set([AI_MODEL || "gpt-4o-mini", ...backups])];

  const callAI = (model) =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
      signal: AbortSignal.timeout(40000),
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

  let lastError = "no model tried";
  for (const model of models) {
    // up to 3 tries per model when the service is busy (429 / 503)
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try {
        res = await callAI(model);
      } catch (e) {
        lastError = `${model}: ${e.message}`;
        break; // timeout / network -> next model
      }
      if (res.ok) {
        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content ?? "";
        console.log(`AI ok with model: ${model}`);
        return { raw: parseJSON(content), mode: "ai" };
      }
      const body = (await res.text().catch(() => "")).slice(0, 200);
      lastError = `${model}: AI request failed (${res.status}) ${body}`;
      console.log(lastError);
      if (res.status === 429 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue; // retry same model
      }
      break; // 400/401/404 etc -> try next model
    }
  }
  throw new Error(lastError);
}

// Models sometimes wrap JSON in ```json fences; strip them and parse.
export function parseJSON(content) {
  const cleaned = String(content).replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI did not return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ---------- very small rule-based fallback (demo only) ----------
function fallbackExtract(text) {
  const t = text.toLowerCase();
  const name =
    text.match(/(?:[Ii] am|[Ii]['’]m|[Mm]y name is|[Tt]his is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1] ?? null;
  const phone = text.match(/(\+?\d[\d\s-]{7,14}\d)/)?.[1] ?? null;

  const d = new Date();
  let date = null;
  if (/\btomorrow\b/.test(t)) { d.setDate(d.getDate() + 1); date = d.toISOString().slice(0, 10); }
  else if (/\btoday\b/.test(t)) date = d.toISOString().slice(0, 10);

  const time = /morning/.test(t) ? "morning" : /afternoon/.test(t) ? "afternoon" : /evening/.test(t) ? "evening" : null;

  let department = "General";
  if (/chest|heart|palpitation/.test(t)) department = "Cardiology";
  else if (/child|baby|kid|son|daughter/.test(t)) department = "Pediatrics";
  else if (/bone|fracture|knee|back pain|joint/.test(t)) department = "Orthopedics";

  let urgency = "routine";
  if (/chest pain|can't breathe|cannot breathe|bleeding|unconscious|stroke/.test(t)) urgency = "urgent";
  else if (/pain|fever|vomit|swelling|worse/.test(t)) urgency = "soon";

  return {
    patient_name: name,
    contact: phone,
    reason: text.trim().slice(0, 140) || null,
    preferred_date: date,
    preferred_time: time,
    department,
    urgency,
  };
}