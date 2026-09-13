#!/usr/bin/env node
// Headless pipeline run used by the GitHub Actions cron.
// list -> fetch unseen PDFs -> extract (LLM) -> save -> verify -> open a data PR.
import "dotenv/config";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { listIcwReports, fetchReport } from "./lib/fetcher.js";
import { extractReport, saveReport } from "./lib/extract.js";
import { verifyData } from "./lib/verify.js";
import { readManifest } from "./lib/env.js";

const BRANCH = `data/icw-${new Date().toISOString().slice(0, 10)}`;
const manifest = readManifest();
const known = new Set(manifest.documents.map((d) => d.url));

const listed = await listIcwReports();
const fresh = listed.filter((r) => !known.has(r.url));
console.log(`${listed.length} report(s) on index, ${fresh.length} new.`);

let changed = false;
for (const report of fresh) {
  console.log(`Fetching ${report.url}`);
  const { file } = await fetchReport(report.url);
  const year = Number(file.match(/(\d{4})/)?.[1] ?? new Date().getFullYear());
  console.log(`Extracting ${file} (year ${year})`);
  const { report: parsed, issues, crossChecks } = await extractReport(file, year);
  if (!parsed) {
    console.error(`Schema validation failed for ${file}; skipping. Issues:`, issues);
    continue;
  }
  const saved = saveReport(parsed);
  if (!saved.ok) {
    console.error(`save_report refused data for ${file}:`, saved.issues);
    continue;
  }
  console.log(`Saved ${saved.file}`, crossChecks);
  changed = true;
}

const integrity = verifyData();
if (!integrity.ok) {
  console.error("verify_data found errors — not opening a PR:", integrity.issues);
  process.exit(1);
}

if (!changed) {
  console.log("No new data; no PR needed.");
  process.exit(0);
}

// Open a human-reviewed PR
execSync(`git checkout -b ${BRANCH}`, { stdio: "inherit" });
execSync(
  `git add data/ && git commit -m "data: ingest ${fresh.length} ICW report(s) from ${new Date().toISOString().slice(0, 10)}"`,
  { stdio: "inherit" },
);
execSync(`git push -u origin ${BRANCH}`, { stdio: "inherit" });
const body = [
  "## Automated ICW data ingestion",
  "",
  `New reports ingested: ${fresh.length}. \`${verifyData.name}\` integrity sweep passed.`,
  "",
  "**Review checklist:**",
  "- Spot-check 2–3 amounts against the linked source PDF pages",
  "- Check suspect names and statuses",
  "- Compare detailed-case sums with reported totals (expected gap is normal)",
].join("\n");
execSync(
  `gh pr create --title "data: ICW report ingestion ${new Date().toISOString().slice(0, 10)}" --body ${JSON.stringify(body)}`,
  { stdio: "inherit", env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "" } },
);
console.log("Data PR opened.");
