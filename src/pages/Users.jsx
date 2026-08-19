import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { createUser, getUsers, updateUser } from "../services/usersApi";
import "./Users.css";

const EMPTY_USER_FORM = {
  fullName: "",
  email: "",
  password: "",
  newPassword: "",
  roleName: "Accounting",
  isActive: true,
};

const ROLE_LABELS = {
  Admin: "Admin",
  Accounting: "Muhasebe",
};

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_USER_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async ({ signal } = {}) => {
    setLoading(true);
    setError("");

    try {
      const data = await getUsers({ signal });
      setUsers(data);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "Kullanıcılar yüklenirken hata oluştu.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      loadUsers({ signal: controller.signal });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadUsers]);

  const columns = useMemo(
    () => [
      { field: "fullName", headerName: "Ad Soyad", flex: 1, minWidth: 180 },
      { field: "email", headerName: "E-posta", flex: 1, minWidth: 220 },
      {
        field: "roleName",
        headerName: "Rol",
        width: 140,
        valueFormatter: (value) => ROLE_LABELS[value] || value,
      },
      {
        field: "isActive",
        headerName: "Durum",
        width: 120,
        valueFormatter: (value) => (value ? "Aktif" : "Pasif"),
      },
    ],
    [],
  );

  function resetForm() {
    setEditingUser(null);
    setForm(EMPTY_USER_FORM);
    setFormError("");
  }

  function handleRowClick(params) {
    setEditingUser(params.row);
    setForm({
      fullName: params.row.fullName || "",
      email: params.row.email || "",
      password: "",
      newPassword: "",
      roleName: params.row.roleName || "Accounting",
      isActive: Boolean(params.row.isActive),
    });
    setFormError("");
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitting(true);
    setFormError("");

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          roleName: form.roleName,
          isActive: form.isActive,
          newPassword: form.newPassword.trim() || null,
        });
      } else {
        await createUser({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          roleName: form.roleName,
          isActive: form.isActive,
        });
      }

      resetForm();
      await loadUsers();
    } catch (requestError) {
      setFormError(requestError.message || "Kullanıcı kaydedilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="users-page">
      <section className="users-header">
        <div>
          <h1>Kullanıcı Yönetimi</h1>
          <p>Admin kullanıcı ekleyebilir, rol atayabilir ve kullanıcıyı pasifleştirebilir.</p>
        </div>
        <button type="button" onClick={resetForm}>
          Yeni Kullanıcı
        </button>
      </section>

      <div className="users-layout">
        <section className="users-list-card">
          <h2>Kullanıcılar</h2>
          {error && <div className="users-status error">{error}</div>}
          <DataGrid
            rows={users}
            columns={columns}
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            onRowClick={handleRowClick}
            localeText={trTR.components.MuiDataGrid.defaultProps.localeText}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
          />
        </section>

        <section className="users-form-card">
          <h2>{editingUser ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"}</h2>
          <form onSubmit={handleSubmit} className="users-form">
            <label>
              <span>Ad Soyad</span>
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>E-posta</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>Rol</span>
              <select name="roleName" value={form.roleName} onChange={handleChange}>
                <option value="Accounting">Muhasebe</option>
                <option value="Admin">Admin</option>
              </select>
            </label>

            <label className="users-checkbox">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
              />
              <span>Aktif kullanıcı</span>
            </label>

            {!editingUser && (
              <label>
                <span>Şifre</span>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </label>
            )}

            {editingUser && (
              <label>
                <span>Yeni Şifre</span>
                <input
                  type="password"
                  name="newPassword"
                  value={form.newPassword}
                  onChange={handleChange}
                  placeholder="Değişmeyecekse boş bırakın"
                />
              </label>
            )}

            {formError && <div className="users-status error">{formError}</div>}

            <div className="users-form-actions">
              <button type="button" onClick={resetForm} disabled={submitting}>
                Vazgeç
              </button>
              <button type="submit" disabled={submitting}>
                {submitting ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Users;
