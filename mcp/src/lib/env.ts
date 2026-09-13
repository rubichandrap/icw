import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

export function trustedSourceUrls(): string[] {
  return (process.env.TRUSTED_SOURCE_URLS ?? "https://antikorupsi.org/en/dokumen")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function trustedPdfHosts(): string[] {
  return (process.env.TRUSTED_PDF_HOSTS ?? "antikorupsi.org,www.antikorupsi.org")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function llmConfig() {
  const { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } = process.env;
  if (!LLM_API_KEY || !LLM_BASE_URL || !LLM_MODEL) {
    throw new Error(
      "LLM not configured. Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL in .env (see .env.example).",
    );
  }
  return { apiKey: LLM_API_KEY, baseUrl: LLM_BASE_URL.replace(/\/$/, ""), model: LLM_MODEL };
}

export function isTrustedPdfUrl(rawUrl: string): boolean {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  const trusted = trustedPdfHosts();
  return trusted.some((t) => host === t || host.endsWith(`.${t}`));
}

export const DATA_DIR = path.resolve("data");
export const SOURCES_DIR = path.join(DATA_DIR, "sources");
export const REPORTS_DIR = path.join(DATA_DIR, "reports");
export const MANIFEST_PATH = path.join(DATA_DIR, "manifest.json");

export interface Manifest {
  fetchedAt: string;
  documents: { url: string; file: string; sha256: string; pages: number }[];
}

export function readManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) return { fetchedAt: new Date().toISOString(), documents: [] };
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

export function writeManifest(m: Manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + "\n");
}
