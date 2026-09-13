import { z } from "zod";

/**
 * Every rupiah figure on the site must trace back to a page in a
 * published ICW PDF. `sourcePage` is 1-based; amounts are IDR.
 */

export const suspectStatusSchema = z.enum([
  "fugitive",
  "suspect",
  "on-trial",
  "convicted",
  "acquitted",
]);

export const suspectSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1), // e.g. "Governor", "Ministry official"
  status: suspectStatusSchema,
});

export const caseSchema = z.object({
  id: z.string().min(1), // slug, unique within a report
  name: z.string().min(1), // commonly known case name
  description: z.string().min(1),
  year: z.number().int().min(1960).max(2100),
  sector: z.string().min(1), // procurement, infrastructure, aid, ...
  institution: z.string().min(1),
  suspects: z.array(suspectSchema).default([]),
  stateLossIDR: z.number().nonnegative(),
  sentence: z.string().optional(),
  sourcePage: z.number().int().min(1),
});

export const reportSchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    title: z.string().min(1),
    sourceUrl: z.string().url(),
    fetchedAt: z.string().datetime(),
    language: z.enum(["id", "en"]),
    totals: z.object({
      totalStateLossIDR: z.number().nonnegative(),
      caseCount: z.number().int().nonnegative(),
      suspectCount: z.number().int().nonnegative(),
      sourcePage: z.number().int().min(1),
    }),
    cases: z.array(caseSchema).min(1),
  })
  .superRefine((r, ctx) => {
    const ids = new Set<string>();
    for (const c of r.cases) {
      if (ids.has(c.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cases"],
          message: `Duplicate case id "${c.id}"`,
        });
      }
      ids.add(c.id);
      if (c.year > r.year) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cases"],
          message: `Case ${c.id} is dated ${c.year}, after report year ${r.year}`,
        });
      }
    }
  });

export type Report = z.infer<typeof reportSchema>;
export type Case = z.infer<typeof caseSchema>;
export type Suspect = z.infer<typeof suspectSchema>;
