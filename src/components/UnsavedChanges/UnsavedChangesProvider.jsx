import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { FiAlertTriangle } from "react-icons/fi";
import { UnsavedChangesContext } from "./UnsavedChangesContext";
import { matchingChanges } from "./formsEqual";
import "./UnsavedChanges.css";

export default function UnsavedChangesProvider({ children }) {
  const entries = useRef(new Map());
  const [snapshot, setSnapshot] = useState(new Map());
  const [pending, setPending] = useState(null);
  const register = useCallback((id, entry) => {
    entries.current.set(id, entry);
    setSnapshot(new Map(entries.current));
    return () => { entries.current.delete(id); setSnapshot(new Map(entries.current)); };
  }, []);
  const requestLeave = useCallback((action, scope) => {
    if (matchingChanges(entries.current, scope).length) setPending({ action, scope });
    else action();
  }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search || currentLocation.hash !== nextLocation.hash) &&
    matchingChanges(entries.current).length > 0);
  useEffect(() => {
    function beforeUnload(event) {
      if (!matchingChanges(entries.current).length) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  const blockedNavigation = blocker.state === "blocked";
  const affected = matchingChanges(snapshot, blockedNavigation ? undefined : pending?.scope);
  const busy = affected.some(entry => entry.busy);
  function stay() {
    setPending(null);
    if (blockedNavigation) blocker.reset();
  }
  function leave() {
    if (busy) return;
    affected.forEach(entry => entry.discard());
    const action = pending?.action;
    setPending(null);
    if (blockedNavigation) blocker.proceed();
    else action?.();
  }
  const context = useMemo(() => ({ register, requestLeave }), [register, requestLeave]);
  return <UnsavedChangesContext.Provider value={context}>
    {children}
    <Dialog open={!!pending || blockedNavigation} onClose={stay} maxWidth={false}
      sx={{ zIndex: 10000 }} className="unsaved-dialog"
      aria-labelledby="unsaved-title" aria-describedby="unsaved-description">
      <DialogTitle id="unsaved-title">
        <span className="unsaved-icon" aria-hidden="true"><FiAlertTriangle /></span>
        {busy ? "İşlemin tamamlanmasını bekleyin" : "Kaydedilmemiş değişiklikler"}
      </DialogTitle>
      <DialogContent><DialogContentText id="unsaved-description">
        {busy ? "Devam eden kayıt işlemi bitmeden bu ekrandan çıkamazsınız." :
          "Yaptığınız değişiklikler henüz kaydedilmedi. Çıkarsanız bu değişiklikler kaybolacak."}
      </DialogContentText></DialogContent>
      <DialogActions>
        <Button variant="outlined" color="error" disabled={busy} onClick={leave}>Kaydetmeden çık</Button>
        <Button variant="contained" disableElevation autoFocus onClick={stay}>Düzenlemeye devam et</Button>
      </DialogActions>
    </Dialog>
  </UnsavedChangesContext.Provider>;
}
