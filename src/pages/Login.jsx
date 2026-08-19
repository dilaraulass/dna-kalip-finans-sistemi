import { useState } from "react";
import logo from "../assets/logo.png";
import { useAuth } from "../auth/useAuth";
import "./Login.css";

function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      await signIn({
        email: email.trim(),
        password,
      });
    } catch (requestError) {
      setError(
        requestError.status === 401
          ? "E-posta veya şifre hatalı."
          : requestError.message || "Giriş yapılırken bir hata oluştu.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <img src={logo} alt="DNA Kalıp" />
          <div>
            <h1>DNA Kalıp</h1>
            <p>Finans ve Sözleşme Sistemi</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            <span>E-posta</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@dna.local"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Şifrenizi girin"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" disabled={submitting}>
            {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;
