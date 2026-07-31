"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Column {
  key: string;
  label: string;
  width?: string;
  className?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface ResponsiveTableProps {
  columns: Column[];
  data: any[];
  keyExtractor: (row: any) => string;
  renderMobileCard?: (row: any, columns: Column[]) => React.ReactNode;
}

export function ResponsiveTable({
  columns,
  data,
  keyExtractor,
  renderMobileCard,
}: ResponsiveTableProps) {
  const defaultMobileCard = (row: any, cols: Column[]) => (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      {cols.slice(0, 3).map((col) => (
        <div key={col.key} className="flex justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{col.label}</span>
          <span className="text-xs font-medium">{row[col.key]}</span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile View - Cards */}
      <div className="space-y-2 md:hidden">
        {data.map((row) => (
          <div key={keyExtractor(row)}>
            {renderMobileCard ? renderMobileCard(row, columns) : defaultMobileCard(row, columns)}
          </div>
        ))}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`px-3 py-2 text-center font-semibold ${col.className || ""} ${col.width || ""}`}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={keyExtractor(row)}>
                {columns.map((col) => (
                  <TableCell
                    key={`${keyExtractor(row)}-${col.key}`}
                    className={`px-3 py-2 text-center truncate ${col.className || ""} ${col.width || ""}`}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
