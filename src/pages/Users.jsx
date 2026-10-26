import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { createUser, getUsers, updateUser, getRoles } from "../services/usersApi";
import { Link } from "react-router-dom";
import PermissionFields from "../components/PermissionFields";
import RoleEditor from "../components/RoleEditor";
import Drawer from "../components/Drawer/Drawer";
import { userFormChanged } from "../utils/userFormChanges";
import { useLeaveConfirmation, useUnsavedChanges } from "../components/UnsavedChanges/useUnsavedChanges";
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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_USER_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [initialForm, setInitialForm] = useState(EMPTY_USER_FORM);
  const requestLeave = useLeaveConfirmation();
  useUnsavedChanges(formOpen && userFormChanged(form, initialForm), { scope: "users", busy: submitting });

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

  const handleRowClick = useCallback(({ row }) => {
    setEditingUser(row);
    const nextForm = {
      fullName: row.fullName || "", email: row.email || "",
      password: "", newPassword: "", roleName: row.roleName || "Accounting",
      isActive: Boolean(row.isActive), permissionOverrides: row.permissionOverrides || {},
    };
    setInitialForm(nextForm);
    setForm(nextForm);
    setFormError("");
    setFormOpen(true);
  }, []);

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
        renderCell: ({ value }) => <span className={`users-status-badge ${value ? "active" : "inactive"}`}>{value ? "Aktif" : "Pasif"}</span>,
      },
      { field: "actions", headerName: "İşlem", width: 110, sortable: false, filterable: false,
        renderCell: params => <button type="button" className="users-edit-button"
          aria-label={`${params.row.fullName} kullanıcısını düzenle`}
          onClick={event => { event.stopPropagation(); handleRowClick(params); }}>Düzenle</button> },
    ],
    [roleData.roles, handleRowClick],
  );

  function resetForm() {
    setInitialForm(EMPTY_USER_FORM);
    setEditingUser(null);
    setForm(EMPTY_USER_FORM);
    setFormError("");
  }

  function closeForm() {
    if (submitting || roleSaving) return;
    requestLeave(discardChanges, roleEditor ? "roles" : "users");
  }

  function discardChanges() {
    if (roleEditor) { setRoleEditor(null); return; }
    setFormOpen(false);
    resetForm();
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
      setFormOpen(false);
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
        <div className="users-header-actions">
        <Link to="/users/activities">Kullanıcı Hareketleri</Link>
        <button type="button" disabled={loading || Boolean(error)} onClick={() => { resetForm(); setFormOpen(true); }}>
          Yeni Kullanıcı
        </button>
        </div>
      </section>

      <div className="users-layout">
        <section className="users-list-card">
          <div className="users-list-heading"><h2>Kullanıcılar</h2><span>{users.length} kullanıcı</span></div>
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

      </div>
      <Drawer isOpen={formOpen} onClose={closeForm} width={640}
        title={roleEditor ? (roleEditor.id ? "Rolü Düzenle" : "Yeni Rol") : editingUser ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"}
        subtitle="Kullanıcı bilgilerini ve erişim yetkilerini yönetin.">
        {roleEditor ? <RoleEditor key={roleEditor.id || "new"} role={roleEditor.id ? roleEditor : null}
          catalog={roleData.permissions} onBusyChange={setRoleSaving} onClose={closeForm} onSaved={async (created) => {
            setRoleEditor(null); await loadUsers();
            if (created) setForm(current => ({ ...current, roleName: created.name, permissionOverrides: {} }));
          }} /> : <section className="users-editor">
          <form onSubmit={handleSubmit} className="users-form">
            <label>
              <span>Ad Soyad</span>
              <input
                autoFocus
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
            <div className="users-form-actions users-role-actions">
              <button type="button" disabled={submitting} onClick={() => setRoleEditor({})}>+ Yeni Rol</button>
              {form.roleName !== "Admin" && <button type="button" disabled={submitting} onClick={() => setRoleEditor(roleData.roles.find(r => r.name === form.roleName))}>Rolü Düzenle</button>}
            </div>
            {form.roleName === "Admin" ? <p>Admin tüm yetkilere sahiptir.</p> :
              <div className="users-permissions-section">
              <p>Varsayılan yetkiler seçilen rolden gelir. Gerekirse bu kullanıcı için izin verebilir veya engelleyebilirsiniz.</p>
              <PermissionFields catalog={roleData.permissions}
                rolePermissions={roleData.roles.find(r => r.name === form.roleName)?.permissions || []}
                overrides={form.permissionOverrides} disabled={submitting}
                onChange={permissionOverrides => setForm(current => ({ ...current, permissionOverrides }))} /></div>}

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

            <div className="users-form-actions users-save-actions">
              <button type="button" onClick={closeForm} disabled={submitting}>
                Vazgeç
              </button>
              <button type="submit" disabled={submitting}>
                {submitting ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </section>}
      </Drawer>
    </div>
  );
}

export default Users;
