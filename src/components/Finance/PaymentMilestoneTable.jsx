import { useMemo, useRef, useState } from "react";
import {
  ALL_FILTER_VALUE,
  CURRENCY_OPTIONS,
  FINANCE_MODULES,
  PAYMENT_STATUS_OPTIONS,
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
  onPaymentInlineUpdate,
  onInvoiceInlineUpdate,
  onInvoiceInlineValidationError,
}) {
  const [invoiceDrafts, setInvoiceDrafts] = useState({});
  const [savingRowIds, setSavingRowIds] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const cancelledEditRef = useRef("");

  function getInvoiceDraft(row) {
    const draftKey = row.contractId || row.contractNumber;

    return (
      invoiceDrafts[draftKey] || {
        invoiceIssued: Boolean(row.invoiceIssued),
        invoiceNumber: row.invoiceNumber || "",
      }
    );
  }

  function setInvoiceDraft(row, draft) {
    setInvoiceDrafts((currentDrafts) => ({
      ...currentDrafts,
      [row.contractId || row.contractNumber]: draft,
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

    const draftKey = row.contractId || row.contractNumber;
    setSavingRowIds((currentIds) => ({ ...currentIds, [draftKey]: true }));

    try {
      await onInvoiceInlineUpdate?.(row, normalizedDraft);
      setInvoiceDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[draftKey];
        return nextDrafts;
      });
    } catch {
      // Hata mesajı parent bileşende gösteriliyor; draft korunur.
    } finally {
      setSavingRowIds((currentIds) => {
        const nextIds = { ...currentIds };
        delete nextIds[draftKey];
        return nextIds;
      });
    }
  }

  async function commitPaymentDraft(row, field, value) {
    const changes =
      field === "activeDueDays"
        ? { activeDueDays: Number(value) }
        : field === "paymentStatus"
          ? { paymentStatus: value }
          : { [field]: value || null };

    if (
      field === "activeDueDays" &&
      (!Number.isInteger(changes.activeDueDays) || changes.activeDueDays < 0)
    ) {
      onInvoiceInlineValidationError?.("Vade sıfır veya daha büyük bir tam sayı olmalıdır.");
      return;
    }

    const currentValue =
      field === "activeDueDays"
        ? row.activeDueDays
        : field === "paymentStatus"
          ? row.paymentStatus
          : row[field] || "";
    const nextValue = field === "activeDueDays" ? changes.activeDueDays : value || "";

    if (currentValue === nextValue) return;

    setSavingRowIds((currentIds) => ({ ...currentIds, [row.id]: true }));

    try {
      await onPaymentInlineUpdate?.(row, changes);
    } catch {
      // Parent bileşen hata mesajını gösterir; sunucu hatasında satırdaki eski değer korunur.
    } finally {
      setSavingRowIds((currentIds) => {
        const nextIds = { ...currentIds };
        delete nextIds[row.id];
        return nextIds;
      });
    }
  }

  function stopGridEvent(event) {
    event.stopPropagation();
  }

  function renderEditableCell(row, field, label, displayValue, editorType) {
    const isEditable = activeTab === FINANCE_MODULES.supplier;
    const isEditing =
      editingCell?.rowId === row.id && editingCell?.field === field;
    const isSaving = Boolean(savingRowIds[row.id]);

    if (!isEditable) return displayValue;

    if (isEditing) {
      const inputProps = {
        autoFocus: true,
        className: "finance-inline-input finance-editable-input",
        disabled: isSaving,
        "aria-label": `${label} düzenle`,
        onClick: stopGridEvent,
        onKeyDown: (event) => {
          event.stopPropagation();

          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelledEditRef.current = `${row.id}:${field}`;
            setEditingCell(null);
          }
        },
        onBlur: (event) => {
          const editKey = `${row.id}:${field}`;
          if (cancelledEditRef.current === editKey) {
            cancelledEditRef.current = "";
            return;
          }

          setEditingCell(null);
          commitPaymentDraft(row, field, event.currentTarget.value);
        },
      };

      if (editorType === "status") {
        return (
          <select
            {...inputProps}
            value={editingCell.value}
            onChange={(event) =>
              setEditingCell((current) =>
                current ? { ...current, value: event.target.value } : current,
              )
            }
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }

      return (
        <input
          {...inputProps}
          type={editorType}
          min={editorType === "number" ? 0 : undefined}
          step={editorType === "number" ? 1 : undefined}
          value={editingCell.value}
          onChange={(event) =>
            setEditingCell((current) =>
              current ? { ...current, value: event.target.value } : current,
            )
          }
        />
      );
    }

    return (
      <button
        type="button"
        className="finance-editable-cell"
        aria-label={`${label}: ${typeof displayValue === "string" || typeof displayValue === "number" ? displayValue : row.status}. Düzenlemek için tıklayın`}
        title={`${label} düzenle`}
        disabled={isSaving}
        onClick={(event) => {
          stopGridEvent(event);
          const value =
            field === "activeDueDays"
              ? String(row.activeDueDays ?? "")
              : field === "paymentStatus"
                ? row.paymentStatus
                : row[field] || "";
          setEditingCell({ rowId: row.id, field, value });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
      >
        {displayValue}
      </button>
    );
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
          contractAmount: row.contractAmount,
          contractCurrency: row.contractCurrency,
          convertedContractAmount: row.convertedContractAmount,
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
    const isSaving = Boolean(savingRowIds[row.contractId || row.contractNumber]);

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
    const isSaving = Boolean(savingRowIds[row.contractId || row.contractNumber]);

    return (
      <div className="finance-contract-invoice-cell">
        <input
          type="text"
          className="finance-inline-input"
          value={draft.invoiceNumber}
          disabled={!draft.invoiceIssued || isSaving}
          placeholder={draft.invoiceIssued ? "Fatura no" : "-"}
          aria-label={`${row.contractNumber} fatura numarası`}
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
        {row.invoiceDataConflict && (
          <span
            className="finance-invoice-conflict"
            role="status"
            title="Eski hakediş kayıtlarında birden fazla fatura bilgisi vardı. Eski değerler korundu; bu sözleşme için doğru fatura bilgisini girerek çakışmayı çözün."
          >
            Eski fatura verileri çelişkili
          </span>
        )}
      </div>
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
                          <strong>
                            {formatMoney(group.contractAmount, group.contractCurrency)}
                          </strong>
                          {group.contractCurrency !== displayCurrency && (
                            <span>
                              {formatMoney(
                                group.convertedContractAmount,
                                displayCurrency,
                              )}
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    <td className="finance-milestone-cell">
                      <strong>{row.milestoneCondition}</strong>
                      {row.subMilestone && <span>• {row.subMilestone}</span>}
                    </td>
                    <td className="finance-center-cell">
                      {renderEditableCell(
                        row,
                        "activeDueDays",
                        "Vade",
                        row.activeDueDays,
                        "number",
                      )}
                    </td>
                    <td className="finance-center-cell">
                      {renderEditableCell(
                        row,
                        "approvalDate",
                        "Onay tarihi",
                        row.approvalDate || "-",
                        "date",
                      )}
                    </td>
                    <td className="finance-center-cell">
                      {renderEditableCell(
                        row,
                        "paymentDate",
                        "Ödeme tarihi",
                        row.paymentDate || "-",
                        "date",
                      )}
                    </td>
                    {rowIndex === 0 && (
                      <>
                        <td
                          rowSpan={group.items.length}
                          className="finance-center-cell"
                        >
                          {renderInvoiceIssuedCell(row)}
                        </td>
                        <td rowSpan={group.items.length}>
                          {renderInvoiceNumberCell(row)}
                        </td>
                      </>
                    )}
                    <td className="finance-amount-cell">
                      {formatMoney(row.convertedAmount, displayCurrency)}
                    </td>
                    <td className="finance-center-cell">
                      {renderEditableCell(
                        row,
                        "paymentStatus",
                        "Ödeme durumu",
                        <StatusBadge
                          statusKey={row.statusKey}
                          status={row.status}
                          daysUntilDue={row.daysUntilDue}
                        />,
                        "status",
                      )}
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
