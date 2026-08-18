import type { AnalysisReport } from "@/lib/analysis-types";
import { SYSTEM_PROMPT } from "@/lib/analysis-prompt";

const MODEL = "google/gemini-3.6-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AnalyzeRequest = { imageDataUrl: string; note?: string | undefined };

export class AnalysisError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function assertDataUrl(dataUrl: string) {
  if (!/^data:[^;,]+;base64,.+$/i.test(dataUrl.trim())) {
    throw new AnalysisError("Please upload a valid image file.", 400);
  }
}

function extractReport(raw: string): AnalysisReport {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as AnalysisReport;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as AnalysisReport;
    }
    throw new AnalysisError("The analysis engine returned an unreadable report. Please retry.", 502);
  }
}

/** Runs the vision analysis through the Lovable AI Gateway and returns a structured report. */
export async function analyzeWithGemini(input: AnalyzeRequest): Promise<AnalysisReport> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AnalysisError("AI is not configured. Missing LOVABLE_API_KEY.", 500);

  if (!input?.imageDataUrl || input.imageDataUrl.length < 20) {
    throw new AnalysisError("An image is required.", 400);
  }
  assertDataUrl(input.imageDataUrl);
  const note = typeof input.note === "string" ? input.note.slice(0, 500) : undefined;

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: note
                ? `Analyse this sample and return the JSON report. Grower note: ${note}`
                : "Analyse this sample and return the JSON report.",
            },
            { type: "image_url", image_url: { url: input.imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (response.status === 429) {
    throw new AnalysisError("Too many requests — please try again shortly.", 429);
  }
  if (response.status === 402) {
    throw new AnalysisError("AI credits are exhausted. Please top up to continue.", 402);
  }
  if (!response.ok) {
    const body = await response.text();
    console.error("AI gateway error", response.status, body);
    throw new AnalysisError("The analysis engine could not process this image.", 502);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  if (!raw) throw new AnalysisError("The analysis engine returned an empty report.", 502);
  return extractReport(raw);
}
