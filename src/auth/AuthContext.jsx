import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, login, logout } from "../services/authApi";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCurrentUser() {
      try {
        const currentUser = await getCurrentUser({ signal: controller.signal });
        setUser(currentUser);
      } catch (error) {
        if (error.name !== "AbortError") {
          setUser(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadCurrentUser();

    return () => controller.abort();
  }, []);

  async function signIn(credentials) {
    const currentUser = await login(credentials);
    setUser(currentUser);
    return currentUser;
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      setUser(null);
    }
  }

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const current = await getCurrentUser({ signal: controller.signal });
        if (controller.signal.aborted) return;
        setUser((previous) => JSON.stringify(previous) === JSON.stringify(current) ? previous : current);
      } catch (error) {
        if (!controller.signal.aborted && error.status === 401) setUser(null);
      }
    };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.roleName === "Admin",
      can: (permission) => user?.roleName === "Admin" || Boolean(user?.permissions?.includes(permission)),
      signIn,
      signOut,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
