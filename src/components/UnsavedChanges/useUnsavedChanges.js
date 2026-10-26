import { useContext, useId, useLayoutEffect, useRef, useState } from "react";
import { FormScopeContext, UnsavedChangesContext } from "./UnsavedChangesContext";
import { formsEqual } from "./formsEqual";

export function useLeaveConfirmation() {
  return useContext(UnsavedChangesContext).requestLeave;
}

export function useUnsavedChanges(dirty, { busy = false, scope, onDiscard } = {}) {
  const contextScope = useContext(FormScopeContext);
  const { register, requestLeave } = useContext(UnsavedChangesContext);
  const id = useId();
  const discardRef = useRef(onDiscard);
  useLayoutEffect(() => { discardRef.current = onDiscard; });
  useLayoutEffect(() => register(id, {
    scope: scope || contextScope, dirty, busy, discard: () => discardRef.current?.(),
  }), [id, scope, contextScope, dirty, busy, register]);
  return action => requestLeave(action, [id]);
}

// Mount one form per editing session. The opening values are its saved baseline.
export function useFormChanges(value, { enabled = true, ...options } = {}) {
  const [initial] = useState(() => value);
  return useUnsavedChanges(enabled && !formsEqual(value, initial), options);
}
