import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/notifications", { signal: controller.signal });
        if (!response.ok) throw new Error("Bildirimler alınamadı.");
        setItems(await response.json()); setError("");
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    }
    load(); const timer = window.setInterval(load, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  async function read(id) {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!response.ok) throw new Error("Bildirim okundu olarak işaretlenemedi.");
      setItems(current => current.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) { setError(e.message); }
  }
  return <details className="notifications"><summary>Bildirimler ({items.filter(n => !n.isRead).length})</summary>
    <div className="notifications-panel"><p>Okundu işareti, sözleşmenin tamamlandığı anlamına gelmez.</p>
      {error && <p role="alert">{error}</p>}{items.length === 0 && <p>Bildirim yok.</p>}
      <ul>{items.map(n => <li key={n.id}>
        <Link to={`/contracts?contractId=${n.contractId}`} onClick={() => read(n.id)}>{!n.isRead && "● "}{n.message}</Link>
        <small>{new Date(n.createdAt).toLocaleString("tr-TR")}</small>
      </li>)}</ul>
    </div>
  </details>;
}
