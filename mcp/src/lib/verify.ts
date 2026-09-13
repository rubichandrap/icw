import fs from "node:fs";
import path from "node:path";
import { reportSchema } from "../../../src/schemas/report.js";
import { REPORTS_DIR, MANIFEST_PATH, SOURCES_DIR } from "./env.js";

export interface IntegrityIssue {
  severity: "error" | "warning";
  file: string;
  message: string;
}

/** Repo-wide integrity sweep. Errors block publication; warnings inform reviewers. */
export function verifyData(): { ok: boolean; issues: IntegrityIssue[]; reports: number } {
  const issues: IntegrityIssue[] = [];
  const years = new Set<number>();
  let reportCount = 0;

  if (!fs.existsSync(REPORTS_DIR)) return { ok: true, issues, reports: 0 };

  for (const f of fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".json"))) {
    const file = path.join(REPORTS_DIR, f);
    const parsed = reportSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
    if (!parsed.success) {
      for (const i of parsed.error.issues)
        issues.push({ severity: "error", file: `data/reports/${f}`, message: `${i.path.join(".")}: ${i.message}` });
      continue;
    }
    reportCount++;
    const r = parsed.data;
    if (years.has(r.year)) issues.push({ severity: "error", file: `data/reports/${f}`, message: `Duplicate report year ${r.year}` });
    years.add(r.year);
    if (r.sourceUrl === "unknown")
      issues.push({ severity: "warning", file: `data/reports/${f}`, message: "sourceUrl missing — was this hand-seeded?" });

    const sum = r.cases.reduce((s, c) => s + c.stateLossIDR, 0);
    if (sum > r.totals.totalStateLossIDR)
      issues.push({
        severity: "error",
        file: `data/reports/${f}`,
        message: `Detailed case sum (Rp ${sum}) exceeds stated totals (Rp ${r.totals.totalStateLossIDR})`,
      });
  }

  if (fs.existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    for (const doc of manifest.documents)
      if (!fs.existsSync(doc.file))
        issues.push({ severity: "warning", file: doc.file, message: "Manifest references a missing source PDF" });
  }
  if (fs.existsSync(SOURCES_DIR) && fs.readdirSync(SOURCES_DIR).length === 0)
    issues.push({ severity: "warning", file: "data/sources", message: "No source PDFs fetched yet" });

  return { ok: !issues.some((i) => i.severity === "error"), issues, reports: reportCount };
}
