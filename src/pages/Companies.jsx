import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { useCallback, useEffect, useMemo, useState } from "react";
import Drawer from "../components/Drawer/Drawer";
import {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
} from "../services/companiesApi";
import "./Companies.css";

const COMPANY_TYPES = {
  all: "all",
  customer: "musteri",
  supplier: "tedarikci",
};

const COMPANY_TYPE_OPTIONS = [
  { value: COMPANY_TYPES.all, label: "Tümü" },
  { value: COMPANY_TYPES.customer, label: "Müşteri" },
  { value: COMPANY_TYPES.supplier, label: "Tedarikçi" },
];

const EMPTY_COMPANY_FORM = {
  name: "",
  companyType: COMPANY_TYPES.customer,
  taxNumber: "",
  email: "",
  phone: "",
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});

function formatCompanyType(companyType) {
  if (companyType === COMPANY_TYPES.customer) return "Müşteri";
  if (companyType === COMPANY_TYPES.supplier) return "Tedarikçi";
  return "-";
}

function formatDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatMoney(amount, currency) {
  return `${currencyFormatter.format(amount ?? 0)} ${currency || ""}`.trim();
}

function buildCompanyPayload(form) {
  return {
    name: form.name.trim(),
    companyType: form.companyType || null,
    taxNumber: form.taxNumber.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
  };
}

function buildCompanyForm(company) {
  return {
    name: company?.name || "",
    companyType: company?.companyType || COMPANY_TYPES.customer,
    taxNumber: company?.taxNumber || "",
    email: company?.email || "",
    phone: company?.phone || "",
  };
}

function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [companyTypeFilter, setCompanyTypeFilter] = useState(COMPANY_TYPES.all);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadCompanies = useCallback(async ({ signal } = {}) => {
    await Promise.resolve();

    setLoading(true);
    setError("");

    try {
      const data = await getCompanies({
        companyType: companyTypeFilter,
        search: searchText.trim(),
        signal,
      });

      setCompanies(data);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "Firmalar yüklenirken bir hata oluştu.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [companyTypeFilter, searchText]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      loadCompanies({ signal: controller.signal });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadCompanies]);

  useEffect(() => {
    if (!selectedCompanyId) return;

    const controller = new AbortController();

    async function loadCompanyDetail() {
      await Promise.resolve();

      setDetailLoading(true);
      setDetailError("");

      try {
        const data = await getCompanyById(selectedCompanyId, {
          signal: controller.signal,
        });

        setSelectedCompany(data);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setDetailError(
            requestError.message || "Firma detayı yüklenirken bir hata oluştu.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      loadCompanyDetail();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [selectedCompanyId]);

  const summary = useMemo(
    () => ({
      total: companies.length,
      customers: companies.filter(
        (company) => company.companyType === COMPANY_TYPES.customer,
      ).length,
      suppliers: companies.filter(
        (company) => company.companyType === COMPANY_TYPES.supplier,
      ).length,
      activeContracts: companies.reduce(
        (total, company) => total + (company.activeContractCount || 0),
        0,
      ),
    }),
    [companies],
  );

  const columns = useMemo(
    () => [
      { field: "name", headerName: "Firma", flex: 1, minWidth: 220 },
      {
        field: "companyType",
        headerName: "Tür",
        width: 130,
        valueFormatter: (value) => formatCompanyType(value),
      },
      {
        field: "taxNumber",
        headerName: "Vergi No",
        width: 150,
        valueFormatter: (value) => value || "-",
      },
      {
        field: "email",
        headerName: "E-posta",
        width: 210,
        valueFormatter: (value) => value || "-",
      },
      {
        field: "phone",
        headerName: "Telefon",
        width: 150,
        valueFormatter: (value) => value || "-",
      },
      {
        field: "activeContractCount",
        headerName: "Aktif Sözleşme",
        width: 145,
      },
      {
        field: "archivedContractCount",
        headerName: "Arşiv",
        width: 105,
      },
    ],
    [],
  );

  function openCreateDrawer() {
    setEditingCompany(null);
    setForm(EMPTY_COMPANY_FORM);
    setFormError("");
    setFormDrawerOpen(true);
  }

  function openEditDrawer(company) {
    setEditingCompany(company);
    setForm(buildCompanyForm(company));
    setFormError("");
    setFormDrawerOpen(true);
  }

  function closeDetailDrawer() {
    setSelectedCompanyId(null);
    setSelectedCompany(null);
    setDetailError("");
  }

  function closeFormDrawer() {
    setFormDrawerOpen(false);
    setEditingCompany(null);
    setFormError("");
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleFormSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setFormError("Firma adı zorunludur.");
      return;
    }

    setFormSubmitting(true);
    setFormError("");

    const payload = buildCompanyPayload(form);

    try {
      const savedCompany = editingCompany
        ? await updateCompany(editingCompany.id, payload)
        : await createCompany(payload);

      await loadCompanies();
      setSelectedCompanyId(savedCompany.id);
      setSelectedCompany(savedCompany);
      closeFormDrawer();
    } catch (requestError) {
      setFormError(requestError.message || "Firma kaydedilemedi.");
    } finally {
      setFormSubmitting(false);
    }
  }

  return (
    <section className="companies-page">
      <div className="companies-summary-grid">
        <div className="companies-summary-card total">
          <span>Toplam Firma</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="companies-summary-card customer">
          <span>Müşteri</span>
          <strong>{summary.customers}</strong>
        </div>
        <div className="companies-summary-card supplier">
          <span>Tedarikçi</span>
          <strong>{summary.suppliers}</strong>
        </div>
        <div className="companies-summary-card contracts">
          <span>Aktif Sözleşme</span>
          <strong>{summary.activeContracts}</strong>
        </div>
      </div>

      <div className="companies-panel">
        <div className="companies-header">
          <div>
            <h2>Firmalar</h2>
            <p>{companies.length} kayıt gösteriliyor</p>
          </div>

          <div className="companies-actions">
            <input
              className="companies-search"
              type="search"
              placeholder="Firma, vergi no, e-posta veya telefon ara..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <select
              className="companies-filter"
              value={companyTypeFilter}
              onChange={(event) => setCompanyTypeFilter(event.target.value)}
            >
              {COMPANY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="companies-primary-btn"
              onClick={openCreateDrawer}
            >
              Yeni Firma
            </button>
          </div>
        </div>

        {loading && <div className="companies-status">Firmalar yükleniyor...</div>}

        {!loading && error && <div className="companies-status error">{error}</div>}

        {!loading && !error && (
          <div className="companies-table">
            <DataGrid
              rows={companies}
              columns={columns}
              localeText={trTR.components.MuiDataGrid.defaultProps.localeText}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              pageSizeOptions={[10, 25, 50]}
              disableRowSelectionOnClick
              onRowClick={(params) => setSelectedCompanyId(params.row.id)}
              sx={{
                border: "none",
                "& .MuiDataGrid-row": { cursor: "pointer" },
              }}
            />
          </div>
        )}
      </div>

      <Drawer
        isOpen={!!selectedCompanyId}
        onClose={closeDetailDrawer}
        title="Firma Detayı"
        subtitle={selectedCompany?.name}
        width={620}
      >
        {detailLoading && (
          <div className="companies-status">Detay yükleniyor...</div>
        )}

        {!detailLoading && detailError && (
          <div className="companies-status error">{detailError}</div>
        )}

        {!detailLoading && selectedCompany && (
          <CompanyDetail company={selectedCompany} onEdit={openEditDrawer} />
        )}
      </Drawer>

      <Drawer
        isOpen={formDrawerOpen}
        onClose={closeFormDrawer}
        title={editingCompany ? "Firmayı Düzenle" : "Yeni Firma"}
        subtitle="Firma bilgilerini girin"
        width={520}
      >
        <CompanyForm
          form={form}
          error={formError}
          submitting={formSubmitting}
          submitLabel={editingCompany ? "Güncelle" : "Kaydet"}
          onChange={handleFormChange}
          onSubmit={handleFormSubmit}
        />
      </Drawer>
    </section>
  );
}

function CompanyDetail({ company, onEdit }) {
  return (
    <div className="company-detail">
      <div className="company-detail-actions">
        <button
          type="button"
          className="companies-secondary-btn"
          onClick={() => onEdit(company)}
        >
          Düzenle
        </button>
      </div>

      <div className="company-detail-section">
        <h3>Firma Bilgileri</h3>
        <div className="company-detail-grid">
          <DetailField label="Firma Adı" value={company.name} />
          <DetailField label="Tür" value={formatCompanyType(company.companyType)} />
          <DetailField label="Vergi No" value={company.taxNumber} />
          <DetailField label="E-posta" value={company.email} />
          <DetailField label="Telefon" value={company.phone} />
          <DetailField label="Kayıt Tarihi" value={formatDateTime(company.createdAt)} />
        </div>
      </div>

      <div className="company-detail-section">
        <h3>Bağlı Sözleşmeler</h3>
        {company.contracts.length === 0 ? (
          <div className="companies-empty">Bu firmaya bağlı sözleşme yok.</div>
        ) : (
          <div className="company-contract-list">
            {company.contracts.map((contract) => (
              <div className="company-contract-card" key={contract.id}>
                <div>
                  <strong>{contract.contractNumber}</strong>
                  <span>
                    {formatCompanyType(contract.financeTab)} ·{" "}
                    {formatDate(contract.contractDate)}
                  </span>
                </div>
                <div>
                  <strong>{formatMoney(contract.totalAmount, contract.currency)}</strong>
                  <span>{contract.isArchived ? "Arşiv" : "Aktif"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyForm({
  form,
  error,
  submitting,
  submitLabel,
  onChange,
  onSubmit,
}) {
  return (
    <form className="company-form" onSubmit={onSubmit}>
      {error && <div className="companies-status error">{error}</div>}

      <label>
        <span>Firma Adı</span>
        <input
          name="name"
          value={form.name}
          onChange={onChange}
          required
          autoFocus
        />
      </label>

      <label>
        <span>Firma Türü</span>
        <select
          name="companyType"
          value={form.companyType}
          onChange={onChange}
          required
        >
          <option value={COMPANY_TYPES.customer}>Müşteri</option>
          <option value={COMPANY_TYPES.supplier}>Tedarikçi</option>
        </select>
      </label>

      <label>
        <span>Vergi No</span>
        <input name="taxNumber" value={form.taxNumber} onChange={onChange} />
      </label>

      <label>
        <span>E-posta</span>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
        />
      </label>

      <label>
        <span>Telefon</span>
        <input name="phone" value={form.phone} onChange={onChange} />
      </label>

      <div className="company-form-actions">
        <button
          type="submit"
          className="companies-primary-btn"
          disabled={submitting}
        >
          {submitting ? "Kaydediliyor..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="company-detail-field">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

export default CompaniesPage;
