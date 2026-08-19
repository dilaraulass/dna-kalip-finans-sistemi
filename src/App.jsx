import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import Finance from "./pages/Finance";
import Contracts from "./pages/Contracts";
import Companies from "./pages/Companies";
import PaymentTracking from "./pages/PaymentTracking";
import Login from "./pages/Login";
import Users from "./pages/Users";
import logo from "./assets/logo.png";
import { FaBuilding, FaFileContract, FaUsers } from "react-icons/fa";
import { FaMoneyBillTrendUp } from "react-icons/fa6";
import { HiBars3 } from "react-icons/hi2";
import { FiLogOut } from "react-icons/fi";
import { useState } from "react";
import { useAuth } from "./auth/useAuth";
import "./App.css";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, loading, isAdmin, signOut } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <img src={logo} alt="DNA Kalıp" />
        <span>Uygulama hazırlanıyor...</span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-layout">
      <aside className={sidebarOpen ? "sidebar" : "sidebar closed"}>
        <div className="sidebar-header">
          {sidebarOpen && (
            <div className="logo-container">
              <img src={logo} alt="DNA Kalıp" />
              <span>DNA Kalıp</span>
            </div>
          )}

          <button
            className="toggle-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Menüyü kapat" : "Menüyü aç"}
            aria-label={sidebarOpen ? "Menüyü kapat" : "Menüyü aç"}
          >
            <HiBars3 size={24} />
          </button>
        </div>

        <nav className="sidebar-menu">
          <NavLink to="/finance" className="menu-item" data-label="Finans">
            <FaMoneyBillTrendUp size={20} />
            {sidebarOpen && <span>Finans</span>}
          </NavLink>

          <NavLink to="/contracts" className="menu-item" data-label="Sözleşmeler">
            <FaFileContract size={20} />
            {sidebarOpen && <span>Sözleşmeler</span>}
          </NavLink>

          <NavLink to="/companies" className="menu-item" data-label="Firmalar">
            <FaBuilding size={20} />
            {sidebarOpen && <span>Firmalar</span>}
          </NavLink>

          {isAdmin && (
            <NavLink to="/users" className="menu-item" data-label="Kullanıcılar">
              <FaUsers size={20} />
              {sidebarOpen && <span>Kullanıcılar</span>}
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card" data-label={`${user.fullName} - ${user.roleDisplayName}`}>
            <div className="avatar">{user.fullName?.[0] || "U"}</div>
            {sidebarOpen && (
              <div>
                <div className="user-name">{user.fullName}</div>
                <div className="user-role">{user.roleDisplayName}</div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="logout-btn"
            onClick={signOut}
            data-label="Çıkış Yap"
          >
            <FiLogOut size={18} />
            {sidebarOpen && <span>Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="topbar-title">
            DNA Kalıp Finans ve Sözleşme Sistemi
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Navigate to="/finance" replace />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/payments" element={<PaymentTracking />} />
          {isAdmin && <Route path="/users" element={<Users />} />}
          <Route path="*" element={<Navigate to="/finance" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
