import { z } from 'zod';

/**
 * `inspectionDate` is a calendar day, not an instant (DESIGN.md §2.3). The regex fixes the
 * format; the refine rejects well-formed impossibilities like 2026-02-31, which the regex
 * alone would happily accept.
 */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Must be a real calendar date');

export const createInspectionSchema = z.object({
  // Optional: the offline client mints one so replays are idempotent, but a manual caller
  // shouldn't have to (DESIGN.md §4).
  id: z.uuid('Must be a UUID').optional(),
  inspectionDate: calendarDate,
  machineId: z.string().trim().min(1, 'Required').max(100),
  defectTypeCode: z.string().trim().min(1, 'Required'),
  severityCode: z.string().trim().min(1, 'Required'),
  remarks: z.string().trim().max(1000).optional(),
});

export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;

export const listInspectionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Capped so one request can't ask for the whole table.
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListInspectionsQuery = z.infer<typeof listInspectionsQuerySchema>;

export const inspectionIdParamSchema = z.object({
  id: z.uuid('Must be a UUID'),
});
