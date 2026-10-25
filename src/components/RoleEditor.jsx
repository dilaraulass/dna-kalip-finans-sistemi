import { useState } from "react";
import { saveRole } from "../services/usersApi";
import PermissionFields from "./PermissionFields";

export default function RoleEditor({ role, catalog, onSaved, onClose }) {
  const [name, setName] = useState(role?.displayName || "");
  const [permissions, setPermissions] = useState(role?.permissions || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { const result = await saveRole(role?.id, { displayName: name.trim(), permissions }); await onSaved(result); }
    catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }
  return <section className="users-form-card"><h2>{role ? "Rolü Düzenle" : "Yeni Rol"}</h2>
    <p>Rol değişiklikleri bu rolü kullanan kişilere uygulanır; kullanıcı istisnaları korunur.</p>
    <form className="users-form" onSubmit={submit}>
      <label>Rol adı<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <PermissionFields catalog={catalog} selected={permissions} onChange={setPermissions} disabled={saving} />
      <p>Finansal düzenleme için finans görüntüleme ve sözleşme hazırlama; çıktı, gider ve ödeme işlemleri için finans görüntüleme de seçilmelidir.</p>
      {error && <p role="alert" className="users-status error">{error}</p>}
      <div className="users-form-actions"><button type="button" disabled={saving} onClick={onClose}>Vazgeç</button>
        <button disabled={saving}>{saving ? "Kaydediliyor..." : "Rolü Kaydet"}</button></div>
    </form></section>;
}
