import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import {
  isTrustedPdfUrl,
  readManifest,
  writeManifest,
  SOURCES_DIR,
  trustedSourceUrls,
} from "./env.js";

export interface ListedReport {
  title: string;
  url: string;
  year?: number;
}

const REPORT_TITLE_RE =
  /(laporan akhir tahun|potret korupsi|tren vonis|outlook pemberantasan)/i;

/** Scan the trusted index pages for report PDF links. */
export async function listIcwReports(): Promise<ListedReport[]> {
  const found = new Map<string, ListedReport>();
  for (const indexUrl of trustedSourceUrls()) {
    const res = await fetch(indexUrl);
    if (!res.ok) throw new Error(`Index fetch failed (${res.status}): ${indexUrl}`);
    const html = await res.text();
    const hrefs = [...html.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => m[1]);
    for (const href of hrefs) {
      const url = new URL(href, indexUrl).toString();
      const title = decodeURIComponent(url.split("/").pop() ?? url)
        .replace(/\.pdf.*$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();
      if (!REPORT_TITLE_RE.test(title)) continue;
      if (!found.has(url)) found.set(url, { title, url });
    }
  }
  return [...found.values()];
}

function yearGuess(title: string): number | undefined {
  const m = title.match(/\b(20[0-2]\d)\b/);
  return m ? Number(m[1]) : undefined;
}

/** Download one PDF (trusted hosts only) into data/sources/<year>/ and register it. */
export async function fetchReport(url: string): Promise<{ file: string; pages: number; sha256: string }> {
  if (!isTrustedPdfUrl(url)) {
    throw new Error(
      `Refusing to fetch untrusted URL: ${url}. Only hosts in TRUSTED_PDF_HOSTS are allowed.`,
    );
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error(`Not a PDF: ${url}`);

  const title = decodeURIComponent(url.split("/").pop() ?? "report.pdf");
  const year = yearGuess(title) ?? new Date().getFullYear();
  const dir = path.join(SOURCES_DIR, String(year));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, title.replace(/[^\w.\- ]+/g, "_"));
  fs.writeFileSync(file, buf);

  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const manifest = readManifest();
  manifest.documents = manifest.documents.filter((d) => d.url !== url);
  manifest.documents.push({ url, file: path.relative(process.cwd(), file), sha256, pages: pdf.numPages });
  manifest.fetchedAt = new Date().toISOString();
  writeManifest(manifest);

  return { file: path.relative(process.cwd(), file), pages: pdf.numPages, sha256 };
}

/** Extract the full text of a downloaded PDF, page-numbered. */
export async function pdfText(pdfPath: string): Promise<{ page: number; text: string }[]> {
  const buf = fs.readFileSync(path.resolve(pdfPath));
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages.map((t, i) => ({ page: i + 1, text: t }));
}
