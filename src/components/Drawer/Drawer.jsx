import "./Drawer.css";

function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  width = 500,
  hideHeader = false,
  actions,
  children,
}) {
  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        style={{ width }}
        onClick={(event) => event.stopPropagation()}
      >
        {hideHeader ? (
          <div className="drawer-floating-actions">
            {actions}
            <button
              className="drawer-close drawer-floating-close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="drawer-header">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>

            <button className="drawer-close" onClick={onClose}>
              ×
            </button>
          </div>
        )}

        <div
          className={
            hideHeader ? "drawer-content drawer-content-no-header" : "drawer-content"
          }
        >
          {children}
        </div>
      </aside>
    </div>
  );
}

export default Drawer;
