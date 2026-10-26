import "./Drawer.css";
import { useId } from "react";
import { FormScopeContext } from "../UnsavedChanges/UnsavedChangesContext";
import { useLeaveConfirmation } from "../UnsavedChanges/useUnsavedChanges";

function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  width = 500,
  hideHeader = false,
  actions,
  guardScope,
  children,
}) {
  const scope = useId();
  const requestLeave = useLeaveConfirmation();
  const close = () => requestLeave(onClose, guardScope || scope);
  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={close}>
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
              onClick={close}
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

            <button className="drawer-close" onClick={close}>
              ×
            </button>
          </div>
        )}

        <div
          className={
            hideHeader ? "drawer-content drawer-content-no-header" : "drawer-content"
          }
        >
          <FormScopeContext.Provider value={guardScope || scope}>{children}</FormScopeContext.Provider>
        </div>
      </aside>
    </div>
  );
}

export default Drawer;
