function escapeExcelValue(value) {
  const normalizedValue = value === null || value === undefined ? "" : value;

  return String(normalizedValue)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildExcelTable({ columns, rows }) {
  const colGroup = columns
    .map((column) => `<col style="width:${column.width || 140}px;" />`)
    .join("");
  const headerRow = columns
    .map((column) => `<th>${escapeExcelValue(column.label)}</th>`)
    .join("");
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeExcelValue(column.value(row))}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  return `
    <table>
      <colgroup>${colGroup}</colgroup>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

function downloadExcel(filename, html) {
  const blob = new Blob([`\uFEFF${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getExportDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function exportRowsToExcel({
  filenamePrefix,
  title,
  description,
  columns,
  rows,
}) {
  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #111827; }
          h1 { font-size: 20px; margin-bottom: 6px; }
          p { margin: 4px 0 14px; color: #4b5563; }
          table { border-collapse: collapse; width: 100%; }
          th {
            background: #e5e7eb;
            color: #111827;
            font-weight: 700;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px;
            mso-number-format: "\\@";
          }
        </style>
      </head>
      <body>
        <h1>${escapeExcelValue(title)}</h1>
        ${description ? `<p>${escapeExcelValue(description)}</p>` : ""}
        ${buildExcelTable({ columns, rows })}
      </body>
    </html>
  `;

  downloadExcel(`${filenamePrefix}-${getExportDateStamp()}.xls`, html);
}
