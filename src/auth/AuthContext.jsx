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

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.roleName === "Admin",
      signIn,
      signOut,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
