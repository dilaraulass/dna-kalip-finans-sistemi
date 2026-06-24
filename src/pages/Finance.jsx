import { useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { getContracts } from "../services/databaseService";
import "./Finance.css";
import Drawer from "../components/Drawer/Drawer";
import FinanceDetail from "../components/FinanceDetail/FinanceDetail";

function Finance() {
  const contracts = getContracts();
  const [activeTab, setActiveTab] = useState("supplier");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tümü");
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const supplierPaymentRows = contracts.flatMap((contract) => {
    const hakedisler = contract.finansData?.hakedisler || [];
    const odemeTakibi = contract.odemeTakibi || {};
    const takipKeys = Object.keys(odemeTakibi);

    return hakedisler.map((hakedis, index) => {
      const takipKey = takipKeys[index];
      const takip = takipKey ? odemeTakibi[takipKey] : {};

      const odemeTarihi = takip?.odemeTarihi || "";
      const onayTarihi = takip?.onayTarihi || "";

      let durum = "Bekleyen";

      if (onayTarihi && odemeTarihi) {
        durum = "Ödenen";
      } else if (odemeTarihi && new Date(odemeTarihi) < new Date()) {
        durum = "Geciken";
      }

      return {
        id: `${contract.id}-${index}`,
        sozlesmeNo: contract.finansData?.tamSozlesmeNo || "-",
        tedarikci: contract.tedarikci || "-",
        isEmriNo: contract.finansData?.dnaIsEmriNo || "-",
        referansNo: contract.finansData?.referansNo || "-",
        sozlesmeBedeli: contract.finansData?.toplamTutarNum || 0,
        hakedisSarti: hakedis.sart || "-",
        hakedisOrani: hakedis.oran || 0,
        tutar: hakedis.tutarStr || "-",
        onayTarihi,
        odemeTarihi,
        durum,
        paraBirimi: contract.finansData?.paraBirimi || "-",
      };
    });
  });

  const toplamOdemeSatiri = supplierPaymentRows.length;
  const odenenSayisi = supplierPaymentRows.filter(
    (x) => x.durum === "Ödenen"
  ).length;
  const bekleyenSayisi = supplierPaymentRows.filter(
    (x) => x.durum === "Bekleyen"
  ).length;
  const gecikenSayisi = supplierPaymentRows.filter(
    (x) => x.durum === "Geciken"
  ).length;

  const columns = [
    { field: "sozlesmeNo", headerName: "Sözleşme No", width: 160 },
    { field: "tedarikci", headerName: "Tedarikçi", width: 170 },
    { field: "isEmriNo", headerName: "İş Emri No", width: 120 },
    { field: "referansNo", headerName: "Parça Ref. No", width: 190 },
    {
      field: "sozlesmeBedeli",
      headerName: "Sözleşme Bedeli",
      width: 150,
      valueFormatter: (value) => Number(value).toLocaleString("tr-TR"),
    },
    { field: "hakedisOrani", headerName: "Hakediş %", width: 110 },
    { field: "tutar", headerName: "Tutar", width: 130 },
    { field: "onayTarihi", headerName: "Onay Trh.", width: 120 },
    { field: "odemeTarihi", headerName: "Ödeme Trh.", width: 120 },
    {
      field: "durum",
      headerName: "Durum",
      width: 130,
      renderCell: (params) => (
        <span className={`status-badge ${params.value.toLowerCase()}`}>
          {params.value}
        </span>
      ),
    },
  ];
const filteredRows = supplierPaymentRows.filter((row) => {
  const search = searchText.toLowerCase();

  const matchesSearch =
    row.sozlesmeNo.toLowerCase().includes(search) ||
    row.tedarikci.toLowerCase().includes(search) ||
    row.isEmriNo.toLowerCase().includes(search) ||
    row.referansNo.toLowerCase().includes(search) ||
    row.durum.toLowerCase().includes(search);

  const matchesStatus =
    statusFilter === "Tümü" || row.durum === statusFilter;

  return matchesSearch && matchesStatus;
});

  return (
    <>
          <div className="stats-grid">
        <div
          className={`stat-card total ${statusFilter === "Tümü" ? "selected" : ""}`}
          onClick={() => setStatusFilter("Tümü")}
        >
          <h3>Toplam Ödeme Kalemi</h3>
          <p>{toplamOdemeSatiri}</p>
        </div>

        <div
          className={`stat-card paid ${statusFilter === "Ödenen" ? "selected" : ""}`}
          onClick={() => setStatusFilter("Ödenen")}
        >
          <h3>Ödenen</h3>
          <p>{odenenSayisi}</p>
        </div>

        <div
          className={`stat-card pending ${statusFilter === "Bekleyen" ? "selected" : ""}`}
          onClick={() => setStatusFilter("Bekleyen")}
        >
          <h3>Bekleyen</h3>
          <p>{bekleyenSayisi}</p>
        </div>

        <div
          className={`stat-card overdue ${statusFilter === "Geciken" ? "selected" : ""}`}
          onClick={() => setStatusFilter("Geciken")}
        >
          <h3>Geciken</h3>
          <p>{gecikenSayisi}</p>
        </div>
      </div>

      <div className="finance-tabs">
        <button
          className={activeTab === "supplier" ? "active" : ""}
          onClick={() => setActiveTab("supplier")}
        >
          Tedarikçi Ödemeleri
        </button>

        <button
          className={activeTab === "customer" ? "active" : ""}
          onClick={() => setActiveTab("customer")}
        >
          Müşteri Tahsilatları
        </button>

        <button
          className={activeTab === "expenses" ? "active" : ""}
          onClick={() => setActiveTab("expenses")}
        >
          Ek Gider Faturaları
        </button>

        <button
          className={activeTab === "analysis" ? "active" : ""}
          onClick={() => setActiveTab("analysis")}
        >
          Finansal Analiz
        </button>
      </div>

      <div className="dashboard-section">
        {activeTab === "supplier" && (
          <>
            <div className="table-header">
              <div>
                <h2>Tedarikçi Ödemeleri</h2>
                <p>Hakediş bazlı tedarikçi ödeme kayıtları</p>
              </div>

              <input
                className="table-search"
                type="text"
                placeholder="Sözleşme, tedarikçi, iş emri ara..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

       {/* <div className="status-filters">
        {["Tümü", "Ödenen", "Bekleyen", "Geciken"].map((status) => (
          <button
            key={status}
            className={statusFilter === status ? "active" : ""}
            onClick={() => setStatusFilter(status)}
          >
            {status}
          </button>
        ))}
      </div> */}

            <div style={{ height: 560, width: "100%" }}>
              <DataGrid
              rows={filteredRows}
              columns={columns}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10, page: 0 },
                },
              }}
              localeText={trTR.components.MuiDataGrid.defaultProps.localeText}
              disableRowSelectionOnClick
              onRowClick={(params) => {
              setSelectedRow(params.row);
              setSelectedRowId(params.id);
            }}
            getRowClassName={(params) =>
            params.id === selectedRowId ? "selected-grid-row" : ""
             }
            />
            </div>
          </>
        )}

        {activeTab === "customer" && (
          <p>Müşteri tahsilatları bölümü eklenecek.</p>
        )}

        {activeTab === "expenses" && (
          <p>Ek gider faturaları bölümü eklenecek.</p>
        )}

        {activeTab === "analysis" && (
          <p>Finansal analiz bölümü eklenecek.</p>
        )}
      </div>
      <Drawer
        isOpen={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title="Ödeme Detayı"
        subtitle={selectedRow?.sozlesmeNo}
        width={520}
      >
        <FinanceDetail selectedRow={selectedRow} />
      </Drawer>
    </>
  );
}

export default Finance;