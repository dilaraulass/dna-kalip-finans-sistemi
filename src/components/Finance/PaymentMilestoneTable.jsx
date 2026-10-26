import { useMemo, useRef, useState } from "react";
import { useUnsavedChanges } from "../UnsavedChanges/useUnsavedChanges";
import { hasInvoiceChanges } from "../UnsavedChanges/formsEqual";
import { useAuth } from "../../auth/useAuth";
import { formatDate, sortRows } from "../../services/tableDisplay";
import SortableHeader from "../ui/SortableHeader";
import {
  ALL_FILTER_VALUE,
  CURRENCY_OPTIONS,
  CONTRACT_CURRENCY_OPTION,
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
  const { can } = useAuth();
  const [sort, setSort] = useState({});
  const [savingRowIds, setSavingRowIds] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const cancelledEditRef = useRef("");
  useUnsavedChanges(hasInvoiceChanges(invoiceDrafts), { scope: "finance-inline",
    busy: Object.keys(savingRowIds).length > 0, onDiscard: () => setInvoiceDrafts({}) });
  const confirmPaymentEdit = useUnsavedChanges(!!editingCell && editingCell.value !== editingCell.initial, {
    scope: "finance-inline", busy: Object.keys(savingRowIds).length > 0,
    onDiscard: () => setEditingCell(null),
  });

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
      [row.contractId || row.contractNumber]: { ...draft,
        initial: currentDrafts[row.contractId || row.contractNumber]?.initial || {
          invoiceIssued: Boolean(row.invoiceIssued), invoiceNumber: row.invoiceNumber || "",
        } },
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

    if (currentValue === nextValue) {
      setEditingCell(current => current?.rowId === row.id && current.field === field ? null : current);
      return;
    }

    setSavingRowIds((currentIds) => ({ ...currentIds, [row.id]: true }));

    try {
      await onPaymentInlineUpdate?.(row, changes);
      setEditingCell(current => current?.rowId === row.id && current.field === field && current.value === value ? null : current);
    } catch {
      // Keep the entered value visible and protected when saving fails.
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
    const isEditable = activeTab === FINANCE_MODULES.supplier && can(
      ["approvalDate", "activeDueDays"].includes(field) ? "milestones.approve" : "payments.edit",
    );
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
            confirmPaymentEdit(() => setEditingCell(null));
          }
        },
        onBlur: (event) => {
          const editKey = `${row.id}:${field}`;
          if (cancelledEditRef.current === editKey) {
            cancelledEditRef.current = "";
            return;
          }

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
          confirmPaymentEdit(() => setEditingCell({ rowId: row.id, field, value, initial: value }));
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

    sortRows(rows, sort).forEach((row) => {
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
  }, [rows, sort]);

  function renderInvoiceIssuedCell(row) {
    if (!can("finance.view")) return "***";
    if (!can("payments.edit")) return row.invoiceIssued ? "Evet" : "Hayır";
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
    if (!can("finance.view")) return "***";
    if (!can("payments.edit")) return row.invoiceNumber || "—";
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
            onClick={() => onExportExcel(groupedRows.flatMap((group) => group.items))}
            disabled={rows.length === 0 || !can("documents.export")}
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
            <option value={CONTRACT_CURRENCY_OPTION}>Sözleşmedeki Para Birimi</option>
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
              <SortableHeader field="contractNumber" sort={sort} onSort={setSort}>Sözleşme No</SortableHeader>
              <SortableHeader field="company" sort={sort} onSort={setSort}>{activeTab === FINANCE_MODULES.customer ? "Müşteri" : "Tedarikçi"}</SortableHeader>
              <SortableHeader field="workOrder" sort={sort} onSort={setSort}>İş Emri No</SortableHeader>
              <SortableHeader field="referenceNumber" sort={sort} onSort={setSort}>Parça Ref. No</SortableHeader>
              <SortableHeader field="convertedContractAmount" sort={sort} onSort={setSort}>Sözleşme Bedeli</SortableHeader>
              <SortableHeader field="milestoneCondition" sort={sort} onSort={setSort}>Hakediş Şartı</SortableHeader>
              <SortableHeader field="activeDueDays" sort={sort} onSort={setSort}>Vade</SortableHeader>
              <SortableHeader field="approvalDate" sort={sort} onSort={setSort}>Onay Trh.</SortableHeader>
              <SortableHeader field="paymentDate" sort={sort} onSort={setSort}>Ödeme Trh.</SortableHeader>
              <SortableHeader field="invoiceIssued" sort={sort} onSort={setSort}>Fatura Kesildi</SortableHeader>
              <SortableHeader field="invoiceNumber" sort={sort} onSort={setSort}>Fatura No</SortableHeader>
              <SortableHeader field="convertedAmount" sort={sort} onSort={setSort}>Tutar</SortableHeader>
              <SortableHeader field="status" sort={sort} onSort={setSort}>Durum</SortableHeader>
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

            {groupedRows.map((group, groupIndex) =>
              group.items.map((row, rowIndex) => {
                const rowClasses = [
                  rowIndex === 0 && groupIndex > 0 ? "finance-contract-start" : "",
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
                          {displayCurrency !== CONTRACT_CURRENCY_OPTION && group.contractCurrency !== displayCurrency && (
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
                        formatDate(row.approvalDate),
                        "date",
                      )}
                    </td>
                    <td className="finance-center-cell">
                      {renderEditableCell(
                        row,
                        "paymentDate",
                        "Ödeme tarihi",
                        formatDate(row.paymentDate),
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
                      {formatMoney(row.convertedAmount, row.displayCurrency || displayCurrency)}
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
