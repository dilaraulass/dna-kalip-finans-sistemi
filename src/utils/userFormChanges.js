export function userFormChanged(current, initial) {
  const fields = ["fullName", "email", "password", "newPassword", "roleName", "isActive"];
  if (fields.some(field => current[field] !== initial[field])) return true;
  const currentOverrides = current.permissionOverrides || {};
  const initialOverrides = initial.permissionOverrides || {};
  const keys = new Set([...Object.keys(currentOverrides), ...Object.keys(initialOverrides)]);
  return [...keys].some(key => currentOverrides[key] !== initialOverrides[key]);
}

export function roleFormChanged(name, permissions, role) {
  const initialPermissions = new Set(role?.permissions || []);
  const currentPermissions = new Set(permissions);
  return name !== (role?.displayName || "") || currentPermissions.size !== initialPermissions.size ||
    [...currentPermissions].some(code => !initialPermissions.has(code));
}
