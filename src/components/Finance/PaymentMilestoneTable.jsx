import { useMemo, useState } from "react";
import {
  ALL_FILTER_VALUE,
  CURRENCY_OPTIONS,
  FINANCE_MODULES,
} from "../../constants/financeConstants";
import { formatMoney } from "../../services/financeService";
import StatusBadge from "../ui/StatusBadge";

function PaymentMilestoneTable({
  activeTab,
  rows,
  companies,
  companyLabel,
  companyFilter,
  setCompanyFilter,
  dateStart,
  setDateStart,
  dateEnd,
  setDateEnd,
  displayCurrency,
  setDisplayCurrency,
  setStatusFilter,
  searchText,
  setSearchText,
  selectedRowId,
  setSelectedRow,
  setSelectedRowId,
  onExportExcel,
  onInvoiceInlineUpdate,
  onInvoiceInlineValidationError,
}) {
  const [invoiceDrafts, setInvoiceDrafts] = useState({});
  const [savingInvoiceIds, setSavingInvoiceIds] = useState({});

  function getInvoiceDraft(row) {
    return (
      invoiceDrafts[row.id] || {
        invoiceIssued: Boolean(row.invoiceIssued),
        invoiceNumber: row.invoiceNumber || "",
      }
    );
  }

  function setInvoiceDraft(row, draft) {
    setInvoiceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [row.id]: draft,
    }));
  }

  async function commitInvoiceDraft(row, draft) {
    const normalizedDraft = {
      invoiceIssued: Boolean(draft.invoiceIssued),
      invoiceNumber: draft.invoiceNumber.trim(),
    };

    if (normalizedDraft.invoiceIssued && !normalizedDraft.invoiceNumber) {
      onInvoiceInlineValidationError?.("Fatura kesildiyse fatura no zorunludur.");
      return;
    }

    setSavingInvoiceIds((currentIds) => ({ ...currentIds, [row.id]: true }));

    try {
      await onInvoiceInlineUpdate?.(row, normalizedDraft);
      setInvoiceDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[row.id];
        return nextDrafts;
      });
    } catch {
      // Hata mesajı parent bileşende gösteriliyor; draft korunur.
    } finally {
      setSavingInvoiceIds((currentIds) => {
        const nextIds = { ...currentIds };
        delete nextIds[row.id];
        return nextIds;
      });
    }
  }

  function stopGridEvent(event) {
    event.stopPropagation();
  }

  const groupedRows = useMemo(() => {
    const groups = [];
    const groupMap = new Map();

    rows.forEach((row) => {
      const groupKey = row.contractId || row.contractNumber;
      let group = groupMap.get(groupKey);

      if (!group) {
        group = {
          id: groupKey,
          contractNumber: row.contractNumber,
          company: row.company,
          workOrder: row.workOrder,
          referenceNumber: row.referenceNumber,
          contractAmount: row.convertedContractAmount,
          items: [],
        };
        groupMap.set(groupKey, group);
        groups.push(group);
      }

      group.items.push(row);
    });

    return groups;
  }, [rows]);

  function renderInvoiceIssuedCell(row) {
    const draft = getInvoiceDraft(row);
    const isSaving = Boolean(savingInvoiceIds[row.id]);

    return (
      <input
        type="checkbox"
        className="finance-inline-checkbox"
        checked={draft.invoiceIssued}
        disabled={isSaving}
        onClick={stopGridEvent}
        onChange={(event) => {
          const nextDraft = {
            invoiceIssued: event.target.checked,
            invoiceNumber: event.target.checked ? draft.invoiceNumber : "",
          };

          setInvoiceDraft(row, nextDraft);

          if (!nextDraft.invoiceIssued || nextDraft.invoiceNumber.trim()) {
            commitInvoiceDraft(row, nextDraft);
          }
        }}
      />
    );
  }

  function renderInvoiceNumberCell(row) {
    const draft = getInvoiceDraft(row);
    const isSaving = Boolean(savingInvoiceIds[row.id]);

    return (
      <input
        type="text"
        className="finance-inline-input"
        value={draft.invoiceNumber}
        disabled={!draft.invoiceIssued || isSaving}
        placeholder={draft.invoiceIssued ? "Fatura no" : "-"}
        onClick={stopGridEvent}
        onDoubleClick={stopGridEvent}
        onChange={(event) =>
          setInvoiceDraft(row, {
            ...draft,
            invoiceNumber: event.target.value,
          })
        }
        onBlur={() => commitInvoiceDraft(row, draft)}
        onKeyDown={(event) => {
          event.stopPropagation();

          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    );
  }

  function handleRowClick(row) {
    setSelectedRow(row);
    setSelectedRowId(row.id);
  }

  return (
    <>
      <div className="table-header">
        <div>
          <h2>
            {activeTab === FINANCE_MODULES.customer
              ? "Müşteri Tahsilatları"
              : "Tedarikçi Ödemeleri"}
          </h2>
          <p>{rows.length} hakediş kaydı gösteriliyor</p>
        </div>

        <div className="table-header-actions">
          <input
            className="table-search"
            type="text"
            placeholder="Sözleşme, tedarikçi, iş emri ara..."
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
          <span>{companyLabel}</span>
          <select
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
          >
            <option value={ALL_FILTER_VALUE}>Tümü</option>
            {companies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
        </label>

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
            setCompanyFilter(ALL_FILTER_VALUE);
            setStatusFilter(ALL_FILTER_VALUE);
          }}
        >
          Filtreleri Temizle
        </button>
      </div>

      <div className="finance-grouped-table-wrap">
        <table className="finance-grouped-table">
          <thead>
            <tr>
              <th>Sözleşme No</th>
              <th>{activeTab === FINANCE_MODULES.customer ? "Müşteri" : "Tedarikçi"}</th>
              <th>İş Emri No</th>
              <th>Parça Ref. No</th>
              <th>Sözleşme Bedeli</th>
              <th>Hakediş Şartı</th>
              <th>Vade</th>
              <th>Onay Trh.</th>
              <th>Ödeme Trh.</th>
              <th>Fatura Kesildi</th>
              <th>Fatura No</th>
              <th>Tutar</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.length === 0 && (
              <tr>
                <td colSpan="13" className="finance-grouped-empty-cell">
                  Seçilen filtrelere uygun kayıt bulunamadı.
                </td>
              </tr>
            )}

            {groupedRows.map((group) =>
              group.items.map((row, rowIndex) => {
                const rowClasses = [
                  `finance-row-${row.statusKey}`,
                  row.id === selectedRowId ? "selected-grid-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <tr
                    key={row.id}
                    className={rowClasses}
                    onClick={() => handleRowClick(row)}
                  >
                    {rowIndex === 0 && (
                      <>
                        <td rowSpan={group.items.length} className="finance-group-cell">
                          <strong>{group.contractNumber}</strong>
                        </td>
                        <td rowSpan={group.items.length} className="finance-group-cell">
                          {group.company}
                        </td>
                        <td rowSpan={group.items.length} className="finance-group-cell">
                          {group.workOrder}
                        </td>
                        <td rowSpan={group.items.length} className="finance-group-cell">
                          {group.referenceNumber}
                        </td>
                        <td rowSpan={group.items.length} className="finance-group-cell amount">
                          {formatMoney(group.contractAmount, displayCurrency)}
                        </td>
                      </>
                    )}

                    <td className="finance-milestone-cell">
                      <strong>{row.milestoneCondition}</strong>
                      {row.subMilestone && <span>• {row.subMilestone}</span>}
                    </td>
                    <td className="finance-center-cell">{row.activeDueDays}</td>
                    <td className="finance-center-cell">{row.approvalDate || "-"}</td>
                    <td className="finance-center-cell">{row.paymentDate || "-"}</td>
                    <td className="finance-center-cell">
                      {renderInvoiceIssuedCell(row)}
                    </td>
                    <td>{renderInvoiceNumberCell(row)}</td>
                    <td className="finance-amount-cell">
                      {formatMoney(row.convertedAmount, displayCurrency)}
                    </td>
                    <td className="finance-center-cell">
                      <StatusBadge
                        statusKey={row.statusKey}
                        status={row.status}
                        daysUntilDue={row.daysUntilDue}
                      />
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default PaymentMilestoneTable;
