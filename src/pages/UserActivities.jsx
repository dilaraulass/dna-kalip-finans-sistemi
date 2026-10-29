import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { getUserActivities } from "../services/usersApi";
import { activityQuery, formatActivityTime } from "../services/activityFilters";
import "./Users.css";
import "./UserActivities.css";

const EMPTY = { actorName: "", action: "", from: "", to: "", contractNumber: "", workOrderNumber: "" };
const COLUMNS = [
  { field: "actorName", headerName: "İşlemi Yapan Kullanıcı", minWidth: 190, flex: 1 },
  { field: "actionLabel", headerName: "Yapılan İşlem", minWidth: 240, flex: 1 },
  { field: "createdAt", headerName: "İşlem Tarihi", width: 190, valueFormatter: formatActivityTime },
  { field: "contractNumber", headerName: "Sözleşme Numarası", minWidth: 180, flex: 1 },
  { field: "workOrderNumber", headerName: "İş Emri Numarası", minWidth: 170, flex: 1 },
];

export default function UserActivities() {
  const [filters, setFilters] = useState(EMPTY);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [sorting, setSorting] = useState([{ field: "createdAt", sort: "desc" }]);
  const [data, setData] = useState({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        if (filters.from && filters.to && filters.from > filters.to) throw new Error("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
        const result = await getUserActivities(activityQuery(filters, pagination, sorting), { signal: controller.signal });
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message || "Kullanıcı hareketleri yüklenemedi.");
          setData({ items: [], totalCount: 0 });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, pagination, sorting, refresh]);

  function changeFilter(key, value) {
    setFilters(current => ({ ...current, [key]: value }));
    setPagination(current => ({ ...current, page: 0 }));
  }

  return <div className="users-page">
    <section className="users-header">
      <div><h1>Kullanıcı Hareketleri</h1><p>İşlem zamanı sunucu tarafından kaydedilir; Türkiye saatiyle gösterilir.</p></div>
      <Link to="/users">Kullanıcılara Dön</Link>
    </section>
    <section className="users-list-card">
      <div className="activity-filters">
        {[["actorName", "İşlemi Yapan Kullanıcı"], ["action", "Yapılan İşlem"],
          ["contractNumber", "Sözleşme Numarası"], ["workOrderNumber", "İş Emri Numarası"]].map(([key, label]) =>
          <label key={key}>{label}<input value={filters[key]} maxLength={200} onChange={event => changeFilter(key, event.target.value)} /></label>)}
        <label>İşlem Tarihi Başlangıç<input type="date" value={filters.from} onChange={event => changeFilter("from", event.target.value)} /></label>
        <label>İşlem Tarihi Bitiş<input type="date" value={filters.to} onChange={event => changeFilter("to", event.target.value)} /></label>
      </div>
      <div className="activity-actions">
        <button type="button" onClick={() => { setFilters(EMPTY); setPagination(current => ({ ...current, page: 0 })); }}>Filtreleri Temizle</button>
        <button type="button" onClick={() => setRefresh(current => current + 1)}>Yenile</button>
      </div>
      {error && <div className="users-status error" role="alert">{error}</div>}
      <DataGrid rows={data.items} columns={COLUMNS} rowCount={data.totalCount} loading={loading}
        paginationMode="server" sortingMode="server" paginationModel={pagination}
        onPaginationModelChange={setPagination} sortModel={sorting}
        onSortModelChange={model => { setSorting(model); setPagination(current => ({ ...current, page: 0 })); }}
        pageSizeOptions={[10, 25, 50, 100]} sortingOrder={["asc", "desc"]} disableColumnFilter disableRowSelectionOnClick
        localeText={trTR.components.MuiDataGrid.defaultProps.localeText} autoHeight />
      <p className="activity-note">Sözleşme, hakediş/onay, vade, ödeme ve fatura bilgisi değişiklikleri, ek gider faturası ekleme/düzenleme/silme ve kullanıcı/rol işlemleri gösterilir.
        Eski kayıtların sözleşme ve iş emri bilgileri bulunmayabilir; eski kayıtlarda kullanıcı adı mevcut kullanıcı kaydından gösterilir.
        Daha önce kaydedilmemiş işlemler geriye dönük oluşturulmaz.</p>
    </section>
  </div>;
}
