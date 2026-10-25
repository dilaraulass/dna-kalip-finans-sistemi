import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { getContractCompleters, changeContractWorkflow } from "../services/contractsApi";

export default function ContractWorkflow({ contract, onUpdated }) {
  const { user, can, isAdmin } = useAuth();
  const [completers, setCompleters] = useState([]);
  const [assignee, setAssignee] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canPrepare = can("contracts.edit");
  useEffect(() => {
    if (!canPrepare || contract.workflowStatus === "active") return;
    const controller = new AbortController();
    getContractCompleters({ signal: controller.signal }).then(setCompleters).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [canPrepare, contract.workflowStatus]);
  async function act(action) {
    setBusy(true); setError("");
    try { await changeContractWorkflow(contract.id, action, { version: contract.version, assigneeId: assignee || null, reason }); await onUpdated(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const canComplete = can("finance.edit") && (isAdmin || (contract.workflowStatus === "pending" ? contract.assignedToUserId === user.id : contract.createdByUserId === user.id));
  return <section className="contract-workflow">
    <strong>{{ active: "Aktif", draft: "Taslak", pending: "Tamamlanmayı bekliyor" }[contract.workflowStatus]}</strong>
    {contract.returnReason && <p>İade açıklaması: {contract.returnReason}</p>}
    {contract.workflowStatus !== "active" && <p>Taslak sözleşme finans hesaplarına dahil değildir.</p>}
    {!contract.isArchived && canPrepare && contract.workflowStatus !== "active" && <>
      {(isAdmin || (contract.workflowStatus === "draft" && contract.createdByUserId === user.id)) && <div>
        <label>Sorumlu kişi <select value={assignee} onChange={e => setAssignee(e.target.value)} disabled={busy}>
          <option value="">Yetkili kişi seçin</option>{completers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select></label>
        <button type="button" disabled={!assignee || busy} onClick={() => act("submit")}>Tamamlanmasına Gönder</button>
      </div>}
      {canComplete && <>
        <button type="button" disabled={busy} onClick={() => act("activate")}>Tamamla ve Aktifleştir</button>
        {contract.workflowStatus === "pending" && <div>
          <label>İade açıklaması (tutar yazmayın)<textarea value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label>
          <button type="button" disabled={busy || !reason.trim()} onClick={() => act("return")}>Düzeltme İçin Geri Gönder</button>
        </div>}
      </>}
    </>}
    {error && <p role="alert" className="contracts-status error">{error}</p>}
  </section>;
}
