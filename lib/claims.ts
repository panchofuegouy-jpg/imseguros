import { z } from "zod"
import { priorities, assertClaimTransition } from "@/lib/operations-domain"

/** Un siniestro siempre cuelga de una póliza; el cliente se deriva de ella. */
export const claimCreateSchema = z.object({
  policy_id: z.string().uuid(),
  assignee_id: z.string().uuid().nullable().optional(),
  insurer_name: z.string().trim().max(200).nullable().optional(),
  external_number: z.string().trim().max(120).nullable().optional(),
  claim_type: z.string().trim().min(1).max(120),
  occurrence_date: z.string().date().nullable().optional(),
  reported_at: z.string().datetime().nullable().optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  estimated_amount: z.number().nonnegative().nullable().optional(),
  priority: z.enum(priorities).default("normal"),
})

export const claimPatchSchema = z.object({
  status: z.enum(["draft", "reported", "in_review", "submitted", "awaiting_insurer", "resolved", "closed", "reopened", "archived"]).optional(),
  priority: z.enum(priorities).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  insurer_name: z.string().trim().max(200).nullable().optional(),
  external_number: z.string().trim().max(120).nullable().optional(),
  occurrence_date: z.string().date().nullable().optional(),
  reported_at: z.string().datetime().nullable().optional(),
  estimated_amount: z.number().nonnegative().nullable().optional(),
  reason: z.string().trim().max(2000).optional(),
}).strict()

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(240),
  priority: z.enum(priorities).default("normal"),
  assignee_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
})

export function transitionClaim(status: string, nextStatus: string, reason?: string) {
  return assertClaimTransition(status, nextStatus, reason)
}

export const claimSelect =
  "*, clients(id, nombre, email, documento), policies(id, numero_poliza, tipo, vigencia_fin, companies(id, name))"
