import test from "node:test";
import assert from "node:assert/strict";
import { userFormChanged, roleFormChanged } from "./userFormChanges.js";

const initial = { fullName: "Dilara", email: "test@example.com", password: "", newPassword: "", roleName: "Accounting", isActive: true, permissionOverrides: {} };
test("unchanged user form has no unsaved changes", () => {
  assert.equal(userFormChanged({ ...initial }, initial), false);
});
test("all user fields including password and active state detect changes", () => {
  for (const field of ["fullName", "email", "password", "newPassword", "roleName", "isActive"]) {
    assert.equal(userFormChanged({ ...initial, [field]: field === "isActive" ? false : "changed" }, initial), true, field);
  }
});
test("overrides distinguish inheritance from explicit allow or deny", () => {
  assert.equal(userFormChanged({ ...initial, permissionOverrides: { view: false } }, initial), true);
  assert.equal(userFormChanged(initial, { ...initial, permissionOverrides: { view: true } }), true);
  assert.equal(userFormChanged({ ...initial, permissionOverrides: { a: true, b: false } }, { ...initial, permissionOverrides: { b: false, a: true } }), false);
});
test("restoring original values clears dirty state", () => {
  const changed = { ...initial, fullName: "new", permissionOverrides: { view: true } };
  changed.fullName = initial.fullName;
  delete changed.permissionOverrides.view;
  assert.equal(userFormChanged(changed, initial), false);
});
test("role changes compare permission sets without depending on order", () => {
  const role = { displayName: "Muhasebe", permissions: ["a", "b"] };
  assert.equal(roleFormChanged("Muhasebe", ["b", "a"], role), false);
  assert.equal(roleFormChanged("Yeni", ["a", "b"], role), true);
  assert.equal(roleFormChanged("Muhasebe", ["a"], role), true);
  assert.equal(roleFormChanged("Muhasebe", ["a", "b", "c"], role), true);
  assert.equal(roleFormChanged("", [], null), false);
  assert.equal(roleFormChanged("Rol", [], null), true);
});
