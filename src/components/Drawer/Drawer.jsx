import "./Drawer.css";

function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  width = 500,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <button className="drawer-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="drawer-content">
          {children}
        </div>
      </aside>
    </div>
  );
}

export default Drawer;