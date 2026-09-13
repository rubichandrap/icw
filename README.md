# The Ledger of Stolen Money

An independent recap of **Indonesian Corruption Watch (ICW)** reports: who stole what
from the people of Indonesia, scaled to things you can feel — teachers, schools, roads.
Not affiliated with ICW; every figure links back to its source PDF page.

## Stack

- **Site**: Astro 5 + Tailwind 4, static output, hand-built SVG/CSS visuals (no chart libs).
- **Data**: strict zod-validated JSON in `data/reports/<year>.json`; source PDFs in `data/sources/`.
- **MCP server** (`mcp/`): exposes the whole pipeline as tools so any agent — interactive or CI —
  executes identical logic.

## Quick start

```bash
pnpm install
cp .env.example .env      # then fill in LLM_API_KEY (see below)
pnpm dev                  # site at http://localhost:4321
pnpm build                # static build in dist/
pnpm verify               # data integrity sweep (also: tsx mcp/src/cli.ts list)
```

## Environment (.env)

| Variable | Purpose |
|---|---|
| `TRUSTED_SOURCE_URLS` | Comma-separated index pages the fetcher may scrape |
| `TRUSTED_PDF_HOSTS` | Comma-separated hosts the fetcher may download PDFs from — everything else is refused |
| `LLM_BASE_URL` | Any OpenAI-compatible API URL (e.g. `https://api.openai.com/v1`) |
| `LLM_API_KEY` | API key for the parser agent |
| `LLM_MODEL` | Model used for extraction (temperature 0, JSON mode) |

## MCP tools (see `.mcp.json`)

Run with `pnpm mcp`. The intended workflow:

1. `list_icw_reports` — browse the trusted index (no downloads).
2. `fetch_report {url}` — download a PDF from a trusted host into `data/sources/`.
3. `extract_report {pdfPath, reportYear}` — LLM extraction + schema validation;
   returns per-field issues and cross-checks (e.g. case sum vs. report totals).
4. `save_report {report}` — refuses anything that fails validation, with fix guidance.
5. `verify_data` — repo-wide sweep; **errors block publication**.
6. `build_site` — build and confirm the data renders.

Rules baked into the tools: never invent amounts, always cite `sourcePage`,
never write unvalidated data, never bypass the PR review.

## Scheduled ingestion

`.github/workflows/icw-fetch.yml` runs weekly (Mondays 06:00 UTC):

1. Lists the trusted index for new reports.
2. `mcp/src/agent-run.ts` fetches unseen PDFs, extracts and validates them, and —
   only if `verify_data` passes — opens a **pull request** with a review checklist.
3. Nothing reaches the site without your approval. Set repo secrets `LLM_BASE_URL`,
   `LLM_API_KEY`, `LLM_MODEL` and variables `TRUSTED_SOURCE_URLS`, `TRUSTED_PDF_HOSTS`.

## Seed data

`data/reports/2023.json` and `2024.json` are **hand-curated bootstraps** from ICW's
published headline figures so the site isn't empty before the first pipeline run.
Treat them as indicative; the linked PDFs are authoritative. The agent pipeline
will replace them with page-cited data.
