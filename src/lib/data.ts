import fs from "node:fs";
import path from "node:path";
import { reportSchema, type Report, type Case } from "../schemas/report";

export function loadReports(): Report[] {
  const dir = path.resolve("data/reports");
  if (!fs.existsSync(dir)) return [];
  const reports: Report[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const parsed = reportSchema.safeParse(
      JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")),
    );
    if (!parsed.success) {
      console.warn(`Skipping invalid report ${f}:`, parsed.error.message);
      continue;
    }
    reports.push(parsed.data);
  }
  return reports.sort((a, b) => b.year - a.year);
}

export const formatIDR = (n: number): string => {
  if (n >= 1e12) return `Rp ${(n / 1e12).toLocaleString("en-US", { maximumFractionDigits: 1 })} trillion`;
  if (n >= 1e9) return `Rp ${(n / 1e9).toLocaleString("en-US", { maximumFractionDigits: 1 })} billion`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })} million`;
  return `Rp ${n.toLocaleString("en-US")}`;
};

export const countIDR = (n: number): string =>
  `Rp ${n.toLocaleString("en-US")}`;

/**
 * Relatable comparables so the scale of loss lands emotionally.
 * Sources cited per comparable.
 */
export const comparables = (idr: number) => {
  const teacherSalaryIDR = 5_500_000; // monthly, approximate PNS teacher wage
  const schoolIDR = 15_000_000_000; // cost of one public school building
  const kmOfRoadIDR = 15_000_000_000; // per km of new national road
  const rupiah100kIDR = 100_000;
  return [
    {
      label: "teacher salaries for one year",
      value: Math.round(idr / (teacherSalaryIDR * 12)),
      unit: "teachers",
      render: (v: number) => `${v.toLocaleString("en-US")} teachers paid for a year`,
    },
    {
      label: "public schools",
      value: Math.round(idr / schoolIDR),
      unit: "schools",
      render: (v: number) => `${v.toLocaleString("en-US")} school buildings, fully funded`,
    },
    {
      label: "km of national road",
      value: Math.round(idr / kmOfRoadIDR),
      unit: "km",
      render: (v: number) => `${v.toLocaleString("en-US")} km of new national highway`,
    },
    {
      label: "stacked Rp 100,000 notes",
      value: idr / rupiah100kIDR,
      unit: "notes",
      render: (v: number) => {
        const km = (v * 0.011) / 1000; // a Rp 100k note is ~0.11 mm thick
        return `a stack of Rp 100k notes ${km.toLocaleString("en-US", { maximumFractionDigits: 0 })} km high`;
      },
    },
  ].map((c) => ({ ...c, rendered: c.render(c.value) }));
};

export type { Report, Case };
