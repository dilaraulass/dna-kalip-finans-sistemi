import { CURRENCY_OPTIONS } from "../../constants/financeConstants";
import { useState } from "react";
import { formatDate, sortRows } from "../../services/tableDisplay";
import SortableHeader from "../ui/SortableHeader";
import { formatMoney } from "../../services/financeService";

function InvoiceArchiveTable({
  rows,
  dateStart,
  setDateStart,
  dateEnd,
  setDateEnd,
  displayCurrency,
  setDisplayCurrency,
  searchText,
  setSearchText,
  onExportExcel,
}) {
  const [sort, setSort] = useState({});
  return (
    <>
      <div className="table-header">
        <div>
          <h2>Arşivlenenler</h2>
          <p>{rows.length} faturası kesilmiş kayıt gösteriliyor</p>
        </div>

        <div className="table-header-actions">
          <input
            className="table-search"
            type="text"
            placeholder="Firma, fatura no, sözleşme veya iş emri ara..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <button
            type="button"
            className="finance-primary-btn"
            onClick={() => onExportExcel(sortRows(rows, sort))}
            disabled={rows.length === 0}
          >
            Excel&apos;e Aktar
          </button>
        </div>
      </div>

      <div className="finance-filters">
        <label>
          <span>Başlangıç</span>
          <input
            type="date"
            value={dateStart}
            onChange={(event) => setDateStart(event.target.value)}
          />
        </label>

        <label>
          <span>Bitiş</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(event) => setDateEnd(event.target.value)}
          />
        </label>

        <label>
          <span>Gösterim Kuru</span>
          <select
            value={displayCurrency}
            onChange={(event) => setDisplayCurrency(event.target.value)}
          >
            {CURRENCY_OPTIONS.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="clear-filter-btn"
          onClick={() => {
            setDateStart("");
            setDateEnd("");
          }}
        >
          Tarihleri Temizle
        </button>
      </div>

      <div className="finance-grouped-table-wrap">
        <table className="finance-grouped-table invoice-archive-table">
          <thead>
            <tr>
              <SortableHeader field="sourceLabel" sort={sort} onSort={setSort}>Kaynak</SortableHeader>
              <SortableHeader field="documentNumber" sort={sort} onSort={setSort}>Belge / Sözleşme</SortableHeader>
              <SortableHeader field="company" sort={sort} onSort={setSort}>Firma</SortableHeader>
              <SortableHeader field="workOrder" sort={sort} onSort={setSort}>İş Emri</SortableHeader>
              <SortableHeader field="invoiceNumber" sort={sort} onSort={setSort}>Fatura No</SortableHeader>
              <SortableHeader field="invoiceDate" sort={sort} onSort={setSort}>Fatura Tarihi</SortableHeader>
              <SortableHeader field="convertedAmount" sort={sort} onSort={setSort}>Tutar</SortableHeader>
              <SortableHeader field="status" sort={sort} onSort={setSort}>Durum</SortableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan="8" className="finance-grouped-empty-cell">
                  Faturası kesilmiş kayıt bulunamadı.
                </td>
              </tr>
            )}

            {sortRows(rows, sort).map((row) => (
              <tr key={row.archiveId}>
                <td>{row.sourceLabel}</td>
                <td>{row.documentNumber}</td>
                <td>{row.company}</td>
                <td>{row.workOrder || "-"}</td>
                <td>{row.invoiceNumber || "-"}</td>
                <td>{formatDate(row.invoiceDate)}</td>
                <td className="finance-amount-cell">
                  <strong>{formatMoney(row.originalAmount, row.currency)}</strong>
                  {row.currency !== displayCurrency && (
                    <span>{formatMoney(row.convertedAmount, displayCurrency)}</span>
                  )}
                </td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default InvoiceArchiveTable;
