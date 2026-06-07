const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export function downloadCsv(filename, columns, rows) {
  const header = columns.map((column) => csvCell(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => csvCell(typeof column.value === "function" ? column.value(row) : row[column.value])).join(","),
  );
  const csv = [header, ...body].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
