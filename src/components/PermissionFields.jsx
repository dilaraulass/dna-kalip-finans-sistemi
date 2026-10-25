export default function PermissionFields({ catalog, rolePermissions = [], overrides, selected = [], onChange, disabled = false }) {
  return <fieldset className="permission-fields" disabled={disabled}>
    <legend>Yetkiler</legend>
    {catalog.map(({ code, label }) => <label key={code}>
      <span>{label}{overrides && <small className="permission-role-hint">Bu rolde {rolePermissions.includes(code) ? "izin veriliyor" : "izin verilmiyor"}.</small>}</span>
      {overrides ? <select aria-label={label} value={Object.hasOwn(overrides, code) ? String(overrides[code]) : "inherit"}
        onChange={(event) => {
          const next = { ...overrides };
          if (event.target.value === "inherit") delete next[code]; else next[code] = event.target.value === "true";
          onChange(next);
        }}>
        <option value="inherit">Rolün yetkisini kullan</option>
        <option value="true">Bu kullanıcıya izin ver</option>
        <option value="false">Bu kullanıcıyı engelle</option>
      </select> : <input type="checkbox" checked={selected.includes(code)} onChange={(event) =>
        onChange(event.target.checked ? [...selected, code] : selected.filter(p => p !== code))} />}
    </label>)}
  </fieldset>;
}
