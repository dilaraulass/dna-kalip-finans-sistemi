import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { createUser, getUsers, updateUser, getRoles, getAccessAudit } from "../services/usersApi";
import PermissionFields from "../components/PermissionFields";
import RoleEditor from "../components/RoleEditor";
import "./Users.css";

const EMPTY_USER_FORM = {
  fullName: "",
  email: "",
  password: "",
  newPassword: "",
  roleName: "Accounting",
  isActive: true,
  permissionOverrides: {},
};

const ROLE_LABELS = {
  Admin: "Admin",
  Accounting: "Muhasebe",
};

function Users() {
  const [roleData, setRoleData] = useState({ roles: [], permissions: [] });
  const [roleEditor, setRoleEditor] = useState(null);
  const [audit, setAudit] = useState(null);
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
      const [data, roles] = await Promise.all([getUsers({ signal }), getRoles({ signal })]);
      setRoleData(roles);
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
        valueFormatter: (value) => roleData.roles.find(r => r.name === value)?.displayName || ROLE_LABELS[value] || value,
      },
      {
        field: "isActive",
        headerName: "Durum",
        width: 120,
        valueFormatter: (value) => (value ? "Aktif" : "Pasif"),
      },
    ],
    [roleData.roles],
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
      permissionOverrides: params.row.permissionOverrides || {},
    });
    setFormError("");
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "roleName" ? { permissionOverrides: {} } : {}),
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
          permissionOverrides: form.permissionOverrides,
        });
      } else {
        await createUser({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          permissionOverrides: form.permissionOverrides,
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
                {roleData.roles.map(role => <option key={role.id} value={role.name}>{role.displayName}</option>)}
              </select>
            </label>
            <div className="users-form-actions">
              <button type="button" onClick={() => setRoleEditor({})}>+ Yeni Rol</button>
              {form.roleName !== "Admin" && <button type="button" onClick={() => setRoleEditor(roleData.roles.find(r => r.name === form.roleName))}>Rolü Düzenle</button>}
            </div>
            {form.roleName === "Admin" ? <p>Admin tüm yetkilere sahiptir.</p> :
              <PermissionFields catalog={roleData.permissions}
                rolePermissions={roleData.roles.find(r => r.name === form.roleName)?.permissions || []}
                overrides={form.permissionOverrides} disabled={submitting}
                onChange={permissionOverrides => setForm(current => ({ ...current, permissionOverrides }))} />}

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
      {roleEditor && <RoleEditor key={roleEditor.id || "new"} role={roleEditor.id ? roleEditor : null}
        catalog={roleData.permissions} onClose={() => setRoleEditor(null)} onSaved={async (created) => {
          setRoleEditor(null); await loadUsers();
          if (created) setForm(current => ({ ...current, roleName: created.name, permissionOverrides: {} }));
        }} />}
      <section className="users-list-card">
        <button type="button" onClick={async () => {
          try { setAudit(await getAccessAudit()); } catch (error) { setError(error.message); }
        }}>Son Yetki ve İşlem Kayıtlarını Göster</button>
        {audit && <ul>{audit.map(item => <li key={item.id}>
          {new Date(item.createdAt).toLocaleString("tr-TR")} — {users.find(u => u.id === item.actorId)?.fullName || item.actorId} — {item.action}
          <details><summary>Ayrıntı</summary><pre>{item.details}</pre></details>
        </li>)}</ul>}
      </section>
    </div>
  );
}

export default Users;
