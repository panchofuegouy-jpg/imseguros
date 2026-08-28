import { z } from "zod"

export const claimStatuses = [
  "draft", "reported", "in_review", "submitted", "awaiting_insurer",
  "resolved", "closed", "reopened", "archived",
] as const
export const taskStatuses = ["open", "in_progress", "blocked", "done", "cancelled"] as const
export const priorities = ["low", "normal", "high", "urgent"] as const

export type ClaimStatus = (typeof claimStatuses)[number]

const claimTransitionMatrix: Record<ClaimStatus, readonly ClaimStatus[]> = {
  draft: ["reported", "archived"],
  reported: ["in_review", "archived"],
  in_review: ["submitted", "resolved", "archived"],
  submitted: ["awaiting_insurer", "resolved", "archived"],
  awaiting_insurer: ["resolved", "reopened", "archived"],
  resolved: ["closed", "reopened", "archived"],
  closed: ["reopened", "archived"],
  reopened: ["in_review", "resolved", "archived"],
  archived: [],
}

export function assertClaimTransition(fromStatus: string, toStatus: string, reason?: unknown) {
  if (!isClaimStatus(fromStatus) || !isClaimStatus(toStatus) || !claimTransitionMatrix[fromStatus].includes(toStatus)) throw new Error("Transición de siniestro inválida")
  if (fromStatus === toStatus) throw new Error("La transición no puede mantener el mismo estado")
  const normalizedReason = typeof reason === "string" ? reason.trim() : ""
  if (["resolved", "closed", "reopened", "archived"].includes(toStatus) && !normalizedReason) throw new Error("El motivo es obligatorio para esta transición")
  return { from_status: fromStatus, to_status: toStatus, ...(normalizedReason ? { reason: normalizedReason } : {}) }
}

export function transitionResponse<T>(resource: T, event: unknown) {
  return { event, resource }
}

export const claimEventInputSchema = z.object({
  type: z.enum(["status_changed", "assigned", "note_added", "reported", "resolved", "closed", "reopened", "archived"]),
  from_status: z.enum(claimStatuses).optional(),
  to_status: z.enum(claimStatuses).optional(),
  reason: z.string().trim().min(1).max(2000).optional(),
  payload: z.record(z.unknown()).default({}),
  effective_at: z.string().datetime().optional(),
}).superRefine((value, ctx) => {
  if (value.type === "status_changed" && (!value.from_status || !value.to_status)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Las transiciones exigen estado origen y destino", path: ["to_status"] })
  }
  if (value.type === "archived" && (value.to_status !== "archived" || !value.from_status)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El archivado exige estado origen y destino archived", path: ["to_status"] })
  }
  if (["resolved", "closed", "reopened", "archived"].includes(value.to_status ?? "") && !value.reason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El motivo es obligatorio para resolver, cerrar, reabrir o archivar", path: ["reason"] })
  }
})

export function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === "string" && claimStatuses.includes(value as ClaimStatus)
}
