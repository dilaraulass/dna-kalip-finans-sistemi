import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { useEffect, useMemo, useState } from "react";
import Drawer from "../components/Drawer/Drawer";
import { getContractById, getContracts } from "../services/contractsApi";
import "./Contracts.css";

const FINANCE_TAB_LABELS = {
  musteri: "Müşteri",
  tedarikci: "Tedarikçi",
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(amount, currency) {
  return `${currencyFormatter.format(amount ?? 0)} ${currency || ""}`.trim();
}

function formatFinanceTab(financeTab) {
  return FINANCE_TAB_LABELS[financeTab] || financeTab || "-";
}

function formatValue(value) {
  return value || "-";
}

function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [financeTabFilter, setFinanceTabFilter] = useState("all");
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadContracts() {
      try {
        setLoading(true);
        setError("");
        const data = await getContracts({ signal: controller.signal });
        setContracts(data);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("Sözleşmeler yüklenirken bir hata oluştu.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadContracts();

    return () => controller.abort();
  }, []);

  const filteredContracts = useMemo(() => {
    const search = searchText.trim().toLocaleLowerCase("tr-TR");

    return contracts.filter((contract) => {
      const matchesFinanceTab =
        financeTabFilter === "all" ||
        contract.financeTab === financeTabFilter;
      const matchesSearch =
        !search ||
        [
          contract.contractNumber,
          contract.companyName,
          contract.workOrderNumber,
          contract.projectNumber,
          contract.customerProject,
          contract.partName,
        ]
          .filter(Boolean)
          .some((value) =>
            value.toLocaleLowerCase("tr-TR").includes(search),
          );

      return matchesFinanceTab && matchesSearch;
    });
  }, [contracts, financeTabFilter, searchText]);

  const summary = useMemo(
    () => ({
      total: contracts.length,
      customers: contracts.filter(
        (contract) => contract.financeTab === "musteri",
      ).length,
      suppliers: contracts.filter(
        (contract) => contract.financeTab === "tedarikci",
      ).length,
      milestones: contracts.reduce(
        (total, contract) => total + contract.milestoneCount,
        0,
      ),
    }),
    [contracts],
  );

  const columns = [
    {
      field: "contractNumber",
      headerName: "Sözleşme No",
      width: 160,
    },
    {
      field: "financeTab",
      headerName: "Tür",
      width: 115,
      valueFormatter: (value) => formatFinanceTab(value),
    },
    {
      field: "companyName",
      headerName: "Firma",
      width: 190,
      valueFormatter: (value) => formatValue(value),
    },
    {
      field: "workOrderNumber",
      headerName: "İş Emri",
      width: 110,
      valueFormatter: (value) => formatValue(value),
    },
    {
      field: "contractDate",
      headerName: "Tarih",
      width: 120,
      valueFormatter: (value) => formatValue(value),
    },
    {
      field: "totalAmount",
      headerName: "Tutar",
      width: 145,
      valueFormatter: (value, row) => formatMoney(value, row.currency),
    },
    {
      field: "milestoneCount",
      headerName: "Hakediş",
      width: 95,
    },
    {
      field: "paidMilestoneCount",
      headerName: "Ödenen",
      width: 95,
    },
    {
      field: "partName",
      headerName: "Parça",
      flex: 1,
      minWidth: 160,
      valueFormatter: (value) => formatValue(value),
    },
  ];

  async function handleContractSelect(contractId) {
    setSelectedContractId(contractId);
    setSelectedContract(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const detail = await getContractById(contractId);
      setSelectedContract(detail);
    } catch {
      setDetailError("Sözleşme detayı yüklenirken bir hata oluştu.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedContractId(null);
    setSelectedContract(null);
    setDetailError("");
    setDetailLoading(false);
  }

  return (
    <section className="contracts-page">
      <div className="contracts-summary-grid">
        <button
          type="button"
          className={`contracts-summary-card total ${
            financeTabFilter === "all" ? "selected" : ""
          }`}
          onClick={() => setFinanceTabFilter("all")}
        >
          <span>Toplam Sözleşme</span>
          <strong>{summary.total}</strong>
        </button>
        <button
          type="button"
          className={`contracts-summary-card customer ${
            financeTabFilter === "musteri" ? "selected" : ""
          }`}
          onClick={() => setFinanceTabFilter("musteri")}
        >
          <span>Müşteri Sözleşmesi</span>
          <strong>{summary.customers}</strong>
        </button>
        <button
          type="button"
          className={`contracts-summary-card supplier ${
            financeTabFilter === "tedarikci" ? "selected" : ""
          }`}
          onClick={() => setFinanceTabFilter("tedarikci")}
        >
          <span>Tedarikçi Sözleşmesi</span>
          <strong>{summary.suppliers}</strong>
        </button>
        <div className="contracts-summary-card milestones">
          <span>Toplam Hakediş</span>
          <strong>{summary.milestones}</strong>
        </div>
      </div>

      <div className="contracts-panel">
        <div className="contracts-header">
          <div>
            <h2>Sözleşmeler</h2>
            <p>{filteredContracts.length} kayıt gösteriliyor</p>
          </div>

          <div className="contracts-actions">
            <input
              className="contracts-search"
              type="text"
              placeholder="Sözleşme, firma, iş emri ara..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />

            <select
              className="contracts-filter"
              value={financeTabFilter}
              onChange={(event) => setFinanceTabFilter(event.target.value)}
            >
              <option value="all">Tümü</option>
              <option value="musteri">Müşteri</option>
              <option value="tedarikci">Tedarikçi</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="contracts-status">Sözleşmeler yükleniyor...</div>
        )}

        {!loading && error && (
          <div className="contracts-status error">{error}</div>
        )}

        {!loading && !error && (
          <div style={{ height: 560, width: "100%" }}>
            <DataGrid
              rows={filteredContracts}
              columns={columns}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10, page: 0 },
                },
                sorting: {
                  sortModel: [{ field: "contractDate", sort: "desc" }],
                },
              }}
              localeText={trTR.components.MuiDataGrid.defaultProps.localeText}
              disableRowSelectionOnClick
              onRowClick={(params) => handleContractSelect(params.id)}
              getRowClassName={(params) =>
                params.id === selectedContractId ? "selected-grid-row" : ""
              }
            />
          </div>
        )}
      </div>

      <Drawer
        isOpen={!!selectedContractId}
        onClose={closeDrawer}
        title="Sözleşme Detayı"
        subtitle={selectedContract?.contractNumber}
        width={620}
      >
        {detailLoading && (
          <div className="contracts-status">Detay yükleniyor...</div>
        )}

        {!detailLoading && detailError && (
          <div className="contracts-status error">{detailError}</div>
        )}

        {!detailLoading && selectedContract && (
          <ContractDetail contract={selectedContract} />
        )}
      </Drawer>
    </section>
  );
}

function ContractDetail({ contract }) {
  return (
    <div className="contract-detail">
      <div className="contract-detail-section">
        <h3>Genel Bilgiler</h3>
        <div className="contract-detail-grid">
          <DetailField label="Sözleşme No" value={contract.contractNumber} />
          <DetailField label="Tür" value={formatFinanceTab(contract.financeTab)} />
          <DetailField label="Firma" value={contract.company?.name} />
          <DetailField label="Tarih" value={contract.contractDate} />
          <DetailField label="İş Emri" value={contract.workOrderNumber} />
          <DetailField label="Referans No" value={contract.referenceNumber} />
          <DetailField label="Proje No" value={contract.projectNumber} />
          <DetailField label="Parça" value={contract.partName} />
          <DetailField label="Kalıp Sayısı" value={contract.moldCount} />
          <DetailField
            label="Sözleşme Bedeli"
            value={formatMoney(contract.totalAmount, contract.currency)}
          />
        </div>
      </div>

      <div className="contract-detail-section">
        <h3>Firma Bilgileri</h3>
        <div className="contract-detail-grid">
          <DetailField label="Firma Türü" value={contract.company?.companyType} />
          <DetailField label="Vergi No" value={contract.company?.taxNumber} />
          <DetailField label="E-posta" value={contract.company?.email} />
          <DetailField label="Telefon" value={contract.company?.phone} />
        </div>
      </div>

      <div className="contract-detail-section">
        <h3>Hakedişler</h3>
        <div className="contract-milestones">
          {contract.milestones.map((milestone) => (
            <div key={milestone.id} className="contract-milestone-card">
              <header>
                <strong>{milestone.condition || "Hakediş"}</strong>
                <span>{formatMoney(milestone.amount, contract.currency)}</span>
              </header>
              <p>Takip anahtarı: {milestone.trackingKey}</p>
              <p>Oran: %{currencyFormatter.format(milestone.rate ?? 0)}</p>
              <p>Vade: {milestone.dueDays} gün</p>
              <p>
                Durum:{" "}
                {milestone.paymentTracking?.status === "paid"
                  ? "Ödendi"
                  : "Bekliyor"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="contract-detail-field">
      <span>{label}</span>
      <strong>{formatValue(value)}</strong>
    </div>
  );
}

export default ContractsPage;
