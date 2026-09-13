#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listIcwReports, fetchReport, pdfText } from "./lib/fetcher.js";
import { extractReport, saveReport } from "./lib/extract.js";
import { verifyData } from "./lib/verify.js";
import { trustedSourceUrls, trustedPdfHosts } from "./lib/env.js";

const server = new McpServer(
  { name: "icw-ledger", version: "0.1.0" },
  {
    instructions: `Pipeline for turning Indonesian Corruption Watch (ICW) PDF reports into validated site data.

WORKFLOW: list_icw_reports -> fetch_report -> extract_report -> save_report -> verify_data.
RULES: only fetch from hosts in TRUSTED_PDF_HOSTS. Never invent amounts; every figure
needs a sourcePage citation. save_report refuses invalid data — fix the issues it
reports and retry. Always run verify_data before considering the job done. Data changes
ship via human-reviewed pull request, never pushed directly.`,
  },
);

server.tool(
  "list_icw_reports",
  "Browse the trusted ICW document index pages for report PDFs. No downloads happen here. Call this first to see what is available.",
  {},
  async () => {
    const reports = await listIcwReports();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ indexPages: trustedSourceUrls(), trustedPdfHosts: trustedPdfHosts(), reports }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "fetch_report",
  "Download a report PDF from a TRUSTED host into data/sources/<year>/ and register it in data/manifest.json. Refuses untrusted URLs.",
  { url: z.string().url().describe("Direct https:// PDF URL, host must be in TRUSTED_PDF_HOSTS") },
  async ({ url }) => {
    try {
      const result = await fetchReport(url);
      return { content: [{ type: "text", text: `Downloaded and registered:\n${JSON.stringify(result, null, 2)}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `ERROR: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "extract_report",
  "Run the case-extraction agent over a downloaded PDF and validate it against the site schema. Returns validation issues and cross-checks. Do NOT write data directly; pass the validated report to save_report.",
  { pdfPath: z.string().describe("Path returned by fetch_report"), reportYear: z.number().int() },
  async ({ pdfPath, reportYear }) => {
    try {
      const result = await extractReport(pdfPath, reportYear);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `ERROR: ${(e as Error).message}` }], isError: true };
    }
  },
);

server.tool(
  "save_report",
  "Write data/reports/<year>.json — ONLY succeeds if the report passes full schema validation. On failure it lists exactly what to fix.",
  { report: z.unknown().describe("The report object returned by extract_report") },
  async ({ report }) => {
    const result = saveReport(report);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.ok,
    };
  },
);

server.tool(
  "verify_data",
  "Run repo-wide integrity checks: schema validity, duplicate years/case ids, totals reconciliation, orphaned source PDFs. Errors block publication.",
  {},
  async () => {
    const result = verifyData();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.ok,
    };
  },
);

server.tool(
  "build_site",
  "Build the Astro site and report per-page output so you can confirm the data renders.",
  {},
  async () => {
    const { execSync } = await import("node:child_process");
    try {
      const out = execSync("pnpm build", { encoding: "utf8", timeout: 120_000 });
      return { content: [{ type: "text", text: out.slice(-4000) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Build failed:\n${(e.stdout ?? "")}${(e.stderr ?? "")}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
