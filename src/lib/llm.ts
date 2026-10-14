import "server-only";

// All model calls go through here so the provider can be swapped in one place.
export const MODELS = {
  fast: process.env.LLM_FAST_MODEL ?? "openai/gpt-oss-20b", // resume extraction, title labels
  writer: process.env.LLM_WRITER_MODEL ?? "openai/gpt-oss-120b", // drafts
};

type Message = { role: "system" | "user"; content: string };

export async function completeJSON<T>(model: string, messages: Message[]): Promise<T> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      reasoning_effort: "low",
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";
  return JSON.parse(content) as T;
}
