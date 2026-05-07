const DEFAULT_SUPABASE_PAGE_SIZE = 1000

type SupabaseListResult<T> = {
  data: T[] | null
  error: unknown
}

export async function fetchAllSupabaseRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<SupabaseListResult<T>>,
  pageSize = DEFAULT_SUPABASE_PAGE_SIZE,
) {
  const rows: T[] = []
  let offset = 0

  while (true) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1)

    if (error) {
      return { data: rows, error }
    }

    if (!data || data.length === 0) {
      return { data: rows, error: null }
    }

    rows.push(...data)

    if (data.length < pageSize) {
      return { data: rows, error: null }
    }

    offset += pageSize
  }
}
