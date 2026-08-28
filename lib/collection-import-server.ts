import { z } from "zod"
import type { NormalizedImportRow, ImportMapping } from "@/lib/collection-import"

export const importRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  raw: z.record(z.string()),
  normalized: z.record(z.union([z.string(), z.number()])),
  errors: z.array(z.object({ field: z.string().optional(), message: z.string() })),
  warnings: z.array(z.object({ field: z.string().optional(), message: z.string() })),
  dedupeKey: z.string().nullable(),
  duplicate: z.boolean().optional(),
  status: z.enum(["valid", "warning", "error"]),
})

export const importBatchPayloadSchema = z.object({
  company_id: z.string().uuid(),
  file_name: z.string().trim().min(1).max(255),
  source_sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  mapping_version_id: z.string().uuid(),
  rows: z.array(importRowSchema).max(10_000),
  source_content_type: z.string().trim().max(120).optional(),
  source_bytes: z.number().int().positive(),
  source_content_base64: z.string().min(1).max(Math.ceil((10 * 1024 * 1024) * 4 / 3) + 4),
})

export const mappingPayloadSchema = z.object({
  company_id: z.string().uuid(),
  mapping: z.record(z.string()),
  normalizers: z.record(z.unknown()).default({}),
})

export type ImportRowInput = z.infer<typeof importRowSchema>
export type ImportBatchInput = z.infer<typeof importBatchPayloadSchema>

export function rowPayload(row: ImportRowInput) {
  return {
    row_number: row.rowNumber,
    raw_payload: row.raw,
    normalized_payload: row.normalized,
    status: row.duplicate ? "skipped" : row.status,
    errors: row.errors,
    warnings: row.warnings,
    dedupe_key: row.dedupeKey,
  }
}

export function batchCounts(rows: NormalizedImportRow[]) {
  return {
    total_rows: rows.length,
    valid_rows: rows.filter((row) => row.status !== "error" && !row.duplicate).length,
    error_rows: rows.filter((row) => row.status === "error").length,
  }
}

export function mappingVersion(mapping: ImportMapping) {
  return JSON.stringify(mapping, Object.keys(mapping).sort())
}
