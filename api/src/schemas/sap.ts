import { z } from 'zod';

/**
 * The SAP QM notification contract (documented in docs/sap-webhook.md).
 *
 * `occurredAt` (an instant) and `inspectionDate` (a calendar day) are both explicit on
 * purpose — a DATEONLY must never be derived from a UTC timestamp, or the day flips either
 * side of midnight depending on the sender's timezone.
 */
export const sapWebhookSchema = z.object({
  eventId: z.string().trim().min(1).max(100),
  occurredAt: z.iso.datetime(),
  notification: z.object({
    // Not validated against our reference data here: SAP's defect catalogue is open-ended,
    // and an unrecognised code is mapped to OTHER rather than rejected (DESIGN.md §5.1).
    defectCode: z.string().trim().min(1).max(50),
    // Severity IS validated against the lookup table in the service — it's a closed,
    // three-value interface contract, and a guessed value would corrupt the summary.
    severityCode: z.string().trim().min(1).max(50),
    workCenter: z.string().trim().min(1).max(100),
    inspectionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
      .refine((value) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
      }, 'Must be a real calendar date'),
    description: z.string().trim().max(900).optional(),
  }),
});

export type SapWebhookPayload = z.infer<typeof sapWebhookSchema>;
