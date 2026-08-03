import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import Finance from "./pages/Finance";
import Contracts from "./pages/Contracts";
import PaymentTracking from "./pages/PaymentTracking";
import logo from "./assets/logo.png";
import { FaFileContract } from "react-icons/fa";
import { FaMoneyBillTrendUp } from "react-icons/fa6";
import { HiBars3 } from "react-icons/hi2";
import { useState } from "react";
import "./App.css";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          >
            <HiBars3 size={24} />
          </button>
        </div>

        <nav className="sidebar-menu">
          <NavLink to="/finance" className="menu-item">
            <FaMoneyBillTrendUp size={20} />
            {sidebarOpen && <span>Finans</span>}
          </NavLink>

          <NavLink to="/contracts" className="menu-item">
            <FaFileContract size={20} />
            {sidebarOpen && <span>Sözleşmeler</span>}
          </NavLink>

        </nav>

       
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
          <Route path="/payments" element={<PaymentTracking />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
