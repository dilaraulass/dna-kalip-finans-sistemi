import { CURRENCY_OPTIONS } from "../../constants/financeConstants";
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
            onClick={onExportExcel}
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
              <th>Kaynak</th>
              <th>Belge / Sözleşme</th>
              <th>Firma</th>
              <th>İş Emri</th>
              <th>Fatura No</th>
              <th>Fatura Tarihi</th>
              <th>Tutar</th>
              <th>Durum</th>
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

            {rows.map((row) => (
              <tr key={row.archiveId}>
                <td>{row.sourceLabel}</td>
                <td>{row.documentNumber}</td>
                <td>{row.company}</td>
                <td>{row.workOrder || "-"}</td>
                <td>{row.invoiceNumber || "-"}</td>
                <td>{row.invoiceDate || "-"}</td>
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
