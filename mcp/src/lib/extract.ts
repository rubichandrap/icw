import fs from "node:fs";
import path from "node:path";
import { reportSchema, type Report } from "../../../src/schemas/report.js";
import { REPORTS_DIR } from "./env.js";
import { pdfText } from "./fetcher.js";
import { llmConfig } from "./env.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ExtractionResult {
  report: Report | null;
  issues: ValidationIssue[];
  crossChecks: string[];
}

const SYSTEM_PROMPT = `You are a meticulous data extractor for an anti-corruption recap site.
You will receive text from an Indonesian Corruption Watch (ICW) report.
Extract corruption cases into JSON matching this shape:

{
  "year": number (report year),
  "title": string,
  "language": "id" | "en",
  "totals": { "totalStateLossIDR": number, "caseCount": number, "suspectCount": number, "sourcePage": number },
  "cases": [{
    "id": "kebab-case-unique-slug",
    "name": string,
    "description": string (1-2 sentences, English),
    "year": number,
    "sector": "procurement" | "social-aid" | "natural-resources" | "finance" | "infrastructure" | "other",
    "institution": string,
    "suspects": [{ "name": string, "role": string, "status": "fugitive"|"suspect"|"on-trial"|"convicted"|"acquitted" }],
    "stateLossIDR": number ( rupiah as a plain number ),
    "sentence": string (optional),
    "sourcePage": number (1-based PDF page)
  }]
}

RULES — violating any of these makes the output unusable:
1. Never invent amounts. If a loss is "Rp 28,4 triliun", stateLossIDR is 28400000000000.
2. Every amount and every case MUST carry the sourcePage it appears on.
3. Only include cases explicitly stated in the text. Omit uncertainty; do not guess.
4. totals must come from the report's own stated totals, not the sum of your cases
   (reports list far more cases than can fit here); note the discrepancy instead.
5. Respond with JSON only, no prose.`;

/** Run the LLM extraction over a downloaded PDF and validate the result. */
export async function extractReport(pdfPath: string, reportYear: number): Promise<ExtractionResult> {
  const { apiKey, baseUrl, model } = llmConfig();
  const pages = await pdfText(pdfPath);
  const pageBlocks = pages.map((p) => `--- PAGE ${p.page} ---\n${p.text}`).join("\n\n");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Report year: ${reportYear}\n\n${pageBlocks.slice(0, 400_000)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as any;
  const raw = JSON.parse(body.choices[0].message.content);

  const candidate = {
    ...raw,
    year: reportYear,
    sourceUrl: candidateSourceUrl(pdfPath),
    fetchedAt: new Date().toISOString(),
  };
  const parsed = reportSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      report: null,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      crossChecks: [],
    };
  }
  const report = parsed.data;

  // cross-checks — surfaced to the reviewing human, not hard failures
  const crossChecks: string[] = [];
  const sum = report.cases.reduce((s, c) => s + c.stateLossIDR, 0);
  crossChecks.push(
    `Detailed cases sum to Rp ${sum.toLocaleString("en-US")}; report totals state Rp ${report.totals.totalStateLossIDR.toLocaleString("en-US")} (expected gap: reports cover more cases than we detail).`,
  );
  if (report.cases.length > report.totals.caseCount)
    crossChecks.push(`WARNING: more detailed cases (${report.cases.length}) than reported caseCount (${report.totals.caseCount}).`);
  for (const c of report.cases)
    if (c.stateLossIDR > report.totals.totalStateLossIDR)
      crossChecks.push(`WARNING: case ${c.id} loss exceeds report total — likely a unit conversion error.`);

  return { report, issues: [], crossChecks };
}

function candidateSourceUrl(pdfPath: string): string {
  const manifest = JSON.parse(fs.readFileSync(path.resolve("data/manifest.json"), "utf8"));
  const doc = manifest.documents.find((d: any) => d.file === path.normalize(pdfPath));
  return doc?.url ?? "unknown";
}

/** Save a report only if it passes the full schema. Returns error messages otherwise. */
export function saveReport(report: unknown): { ok: boolean; file?: string; issues: ValidationIssue[] } {
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const file = path.join(REPORTS_DIR, `${parsed.data.year}.json`);
  fs.writeFileSync(file, JSON.stringify(parsed.data, null, 2) + "\n");
  return { ok: true, file: path.relative(process.cwd(), file), issues: [] };
}

export type { Report };
