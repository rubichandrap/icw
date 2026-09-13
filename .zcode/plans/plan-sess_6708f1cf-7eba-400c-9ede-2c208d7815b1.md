# ICW Recap — "The Ledger of Stolen Money"

A static English-language Astro site that turns Indonesian Corruption Watch reports into a memorable, money-as-scale visual recap of who stole what from Indonesia — fed by a scheduled agent-parsing pipeline, driven through a bundled MCP server.

## Architecture

```
┌─ GitHub Actions cron (weekly) ──────────────────────────────┐
│ 1. fetcher: scrape antikorupsi.org/en/dokumen + trends for  │
│    new Laporan Akhir Tahun / Tren Vonis / Outlook PDFs      │
│ 2. download PDFs → data/sources/YYYY/ (committed, cached)   │
│ 3. parser agent: extract text → LLM with STRICT zod schema  │
│ 4. validate + diff → open PR "data: ICW 2025 report" for    │
│    human review before it ships to the site                 │
└─────────────────────────────────────────────────────────────┘
         ↓ data/reports/*.json (versioned, human-reviewed)
Astro static build → scrollytelling homepage + case archive

+ MCP server (this repo) exposing the pipeline as tools so any
  agent knows HOW to do each step — no tribal shell knowledge.
```

## MCP server (`mcp/`)
A lightweight MCP server (TypeScript, official `@modelcontextprotocol/sdk`, stdio transport) that encodes the workflow as tools, each with rich docstrings teaching the agent the rules (validate before writing, cite source pages, never invent amounts):

- `list_icw_reports()` — browse the antikorupsi.org document index (year, title, PDF URL, language).
- `fetch_report(url)` — download a PDF into `data/sources/YYYY/`, register it in the source manifest, return its path + page count.
- `extract_report(pdfPath)` — run the case-extraction agent over the PDF, validate against the zod schema, return a validation report (per-record errors, totals cross-checks like "sum of cases ≠ reported total").
- `save_report(report)` — write `data/reports/YYYY.json` only if it passes full schema validation; refused otherwise, with fix guidance.
- `verify_data()` — run integrity checks across all reports: duplicate cases, missing citations, totals reconciliation, orphaned source PDFs.
- `build_site()` — run the Astro build and return per-page output/health.

The GitHub Actions cron calls these same tools via the CLI, so the scheduled run and any interactive agent execute identical logic.

## Metadata schema (`src/schemas/report.ts`, zod)
Per report: year, title, sourceUrl, fetchedAt, language. Per case: name, description, year, sector, institution, suspects[] (name, role, status), stateLossIDR, sentence. Totals: totalStateLossIDR, caseCount, suspectCount. Every number carries a `sourcePage` citation back to the PDF.

## Site (Astro + Tailwind, English)
- **Hero scrollytelling "money as scale"**: animated counter of total stolen, then proportional visuals — "Rp 28.4 trillion = X years of Jakarta teachers' salaries = a wall of Rp 100k stacks N km high". Reusable `<MoneyScale>` component renders any amount against relatable comparables.
- **The Wall**: per-case cards grouped by year with suspect names, proportional amount bars, status badges (fugitive/convicted), sector tags — the "remember who" piece.
- **Sector & year breakdown**: horizontal bars, editorial style (no dashboard grid).
- **Sources**: every fact links to the source PDF page.

## Design language (anti-slop)
Editorial ledger aesthetic: ink-black/paper-white with blood-red accents, Fraunces display + Inter body, ruled ledger lines, tabular numerals. No purple gradients, no glassmorphism, no emoji. Charts hand-built in vanilla SVG, animated on scroll.

## Bootstrap data
Hand-curate `data/reports/2023.json` and `2024.json` from published ICW figures (2023: Rp 28.4T losses, 791 cases, 1,695 suspects) with links to the actual PDFs, so the site is never empty pre-cron.

## Deliverables
1. Astro project scaffold (pnpm, Tailwind, strict TS)
2. Schemas + seed data (2023, 2024)
3. Site: hero, MoneyScale, Wall, breakdowns, methodology page
4. MCP server with the six tools above + `.mcp.json` wiring so agents in this repo load it automatically
5. GitHub Actions workflow calling the MCP tools on a weekly cron
6. README: setup, MCP tool reference, how data PRs get reviewed

## Notes
- Data PRs require your approval — the cron never pushes numbers straight to production; `verify_data()` gates every write.
- First build: site + seed data + MCP server + pipeline scripts; you add the LLM key / GitHub secrets at deploy time.