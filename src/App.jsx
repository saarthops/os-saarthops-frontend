import { useEffect, useState } from "react";
import Workspace from "./Workspace.jsx";

const DEVICE_KEY = "saarthops.device-id";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function pageFromLocation() {
  const pages = {
    "/": "signup",
    "/activate": "signup",
    "/signup": "signup",
    "/login": "login",
    "/forgot-password": "forgot",
    "/reset-password": "reset"
  };
  return pages[window.location.pathname] ?? "login";
}

async function request(path, body, method = "POST", authenticated = false) {
  const accessToken = authenticated ? sessionStorage.getItem("saarthops.access-token") : null;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(payload?.description ?? payload?.message ?? `Request failed (${response.status})`);
  }
  return payload;
}

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `browser-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function Field({
  label, name, type = "text", value, onChange, required = true, autoComplete, minLength,
  inputMode, pattern, maxLength, readOnly
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        readOnly={readOnly}
      />
    </label>
  );
}

export default function App() {
  const [page, setPage] = useState(pageFromLocation);
  const [signupTicket, setSignupTicket] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.search).get("token") ?? ""
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(() => {
    const value = sessionStorage.getItem("saarthops.user");
    return value ? JSON.parse(value) : null;
  });

  useEffect(() => {
    const syncPage = () => {
      setPage(pageFromLocation());
      setResetToken(new URLSearchParams(window.location.search).get("token") ?? "");
    };
    window.addEventListener("popstate", syncPage);
    return () => window.removeEventListener("popstate", syncPage);
  }, []);

  function navigate(nextPage) {
    setError("");
    setStatus("");
    setPage(nextPage);
    const paths = {
      signup: "/signup", login: "/login",
      forgot: "/forgot-password", reset: "/reset-password"
    };
    window.history.pushState({}, "", paths[nextPage] ?? "/");
  }

  async function submit(event, action) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action(new FormData(event.currentTarget));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendSignupVerificationCode(form) {
    const email = String(form.get("email")).trim();
    const result = await request("/api/v1/trial/request", { email });
    setSignupEmail(email);
    setCodeSent(true);
    setSignupTicket("");
    setVerifiedEmail("");
    setStatus(result.message);
  }

  async function verifySignupEmail(form) {
    const result = await request("/api/v1/trial/verify", {
      email: signupEmail,
      code: form.get("code")
    });
    setSignupTicket(result.data.signup_ticket);
    setVerifiedEmail(result.data.email);
    setStatus("Email verified. Complete your workspace setup.");
  }

  async function resendVerificationCode() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await request("/api/v1/trial/request", { email: signupEmail });
      setStatus(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function signup(form) {
    const result = await request("/api/v1/signup", {
      signup_ticket: signupTicket,
      first_name: form.get("first_name"),
      last_name: form.get("last_name"),
      company_name: form.get("company_name"),
      email: verifiedEmail,
      password: form.get("password")
    });
    navigate("login");
    setStatus(result.message);
  }

  async function login(form) {
    const result = await request("/api/v1/login", {
      email: form.get("email"),
      password: form.get("password"),
      device_id: deviceId(),
      device_name: navigator.userAgent.slice(0, 100)
    });
    sessionStorage.setItem("saarthops.user", JSON.stringify(result.data.user));
    sessionStorage.setItem("saarthops.access-token", result.data.access_token);
    sessionStorage.setItem("saarthops.refresh-token", result.data.refresh_token);
    setUser(result.data.user);
  }

  async function forgotPassword(form) {
    const result = await request("/api/v1/auth/password/forgot", {
      email: form.get("email")
    });
    setStatus(result.message);
  }

  async function resetPassword(form) {
    const result = await request("/api/v1/auth/password/reset", {
      token: resetToken,
      password: form.get("password")
    });
    navigate("login");
    setStatus(result.message);
  }

  function changeSignupEmail() {
    setSignupEmail("");
    setCodeSent(false);
    setSignupTicket("");
    setVerifiedEmail("");
    setError("");
    setStatus("");
  }

  function logout() {
    const refreshToken = sessionStorage.getItem("saarthops.refresh-token");
    if (refreshToken) {
      request("/api/v1/auth/logout", { refresh_token: refreshToken, device_id: deviceId() })
        .catch(() => {});
    }
    sessionStorage.removeItem("saarthops.user");
    sessionStorage.removeItem("saarthops.access-token");
    sessionStorage.removeItem("saarthops.refresh-token");
    setUser(null);
    navigate("login");
  }

  const titles = {
    signup: signupTicket
      ? ["Set up your workspace", `Verified email: ${verifiedEmail}`]
      : codeSent
        ? ["Verify your email", `Enter the 6-digit code sent to ${signupEmail}.`]
        : ["Create your SaarthOps account", "Enter your email to get a verification code and continue signing up."],
    login: ["Welcome back", "Sign in to your SaarthOps workspace."],
    forgot: ["Reset your password", "We’ll send a secure reset link to your email."],
    reset: ["Choose a new password", "Set a new password for your account."]
  };
  const [title, subtitle] = titles[page] ?? titles.login;

  if (user) {
    return <Workspace user={user} onLogout={logout} />;
  }

  return (
    <main className="layout">
      <section className="brand-panel">
        <img className="brand-wordmark" src="/assets/SaarthOpsLogo.jpeg" alt="SaarthOps — Your Business Saathi" />
        <div className="brand-copy">
          <span className="eyebrow">YOUR BUSINESS, IN SYNC</span>
          <h1>One workspace.<br />Better business.</h1>
          <p>SaarthOps brings customer relationships, team management, communications, and AI-powered workflows together in one connected business operations platform.</p>
        </div>
        <div className="brand-foot">Your Business Saathi · Built for growing teams.</div>
      </section>

      <section className="content-panel">
        <img className="mobile-brand-logo" src="/assets/SaarthOpsLogo.jpeg" alt="SaarthOps — Your Business Saathi" />
        <div className={`form-wrap${user ? " form-wrap-wide" : ""}`}>
          <div className="topline">
            <span>{user ? "WORKSPACE" : "ACCOUNT ACCESS"}</span>
            {user ? (
              <button className="text-button" onClick={logout}>Sign out</button>
            ) : page !== "signup" && page !== "reset" && (
              <button className="text-button" onClick={() => navigate("signup")}>Create account</button>
            )}
          </div>
          {!user && (
            <>
              <h2>{title}</h2>
              <p className="subtitle">{subtitle}</p>
              {status && <div className="notice success-notice" role="status">{status}</div>}
              {error && <div className="notice error-notice" role="alert">{error}</div>}

              {page === "signup" && (
                signupTicket ? <form onSubmit={(event) => submit(event, signup)}>
                  <Field label="Verified email" name="verified_email" type="email" value={verifiedEmail} readOnly />
                  <div className="field-row">
                    <Field label="First name" name="first_name" autoComplete="given-name" />
                    <Field label="Last name" name="last_name" required={false} autoComplete="family-name" />
                  </div>
                  <Field label="Company name" name="company_name" autoComplete="organization" />
                  <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={12} />
                  <p className="hint">Use at least 12 characters.</p>
                  <button className="primary-button" disabled={busy}>{busy ? "Creating workspace…" : "Create account"}</button>
                </form> : codeSent ? (
                  <>
                    <form onSubmit={(event) => submit(event, verifySignupEmail)}>
                      <Field
                        label="Verification code"
                        name="code"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        autoComplete="one-time-code"
                      />
                      <p className="hint">The code expires in 10 minutes.</p>
                      <button className="primary-button" disabled={busy}>{busy ? "Verifying…" : "Verify email"}</button>
                    </form>
                    <p className="form-foot">
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={resendVerificationCode}
                      >
                        Resend code
                      </button>
                      {" · Wrong email? "}
                      <button type="button" className="text-button" disabled={busy} onClick={changeSignupEmail}>
                        Change email
                      </button>
                    </p>
                  </>
                ) : (
                  <form onSubmit={(event) => submit(event, sendSignupVerificationCode)}>
                    <Field
                      label="Work email"
                      name="email"
                      type="email"
                      value={signupEmail}
                      onChange={(event) => setSignupEmail(event.target.value)}
                      autoComplete="email"
                    />
                    <button className="primary-button" disabled={busy}>{busy ? "Sending…" : "Verify email"}</button>
                    <p className="form-foot">Already have an account? <button type="button" className="text-button" onClick={() => navigate("login")}>Sign in</button></p>
                  </form>
                )
              )}

              {page === "login" && (
                <form onSubmit={(event) => submit(event, login)}>
                  <Field label="Email" name="email" type="email" autoComplete="email" />
                  <Field label="Password" name="password" type="password" autoComplete="current-password" />
                  <div className="forgot-row"><button type="button" className="text-button" onClick={() => navigate("forgot")}>Forgot password?</button></div>
                  <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
                  <p className="form-foot">New to SaarthOps? <button type="button" className="text-button" onClick={() => navigate("signup")}>Create an account</button></p>
                </form>
              )}

              {page === "forgot" && (
                <form onSubmit={(event) => submit(event, forgotPassword)}>
                  <Field label="Account email" name="email" type="email" autoComplete="email" />
                  <button className="primary-button" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
                  <p className="form-foot"><button type="button" className="text-button" onClick={() => navigate("login")}>Back to sign in</button></p>
                </form>
              )}

              {page === "reset" && (
                <form onSubmit={(event) => submit(event, resetPassword)}>
                  <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={12} />
                  <p className="hint">Use at least 12 characters.</p>
                  <button className="primary-button" disabled={busy || !resetToken}>{busy ? "Updating…" : "Update password"}</button>
                  {!resetToken && <p className="notice error-notice">Reset token is missing from the link.</p>}
                </form>
              )}

              {page === "login" && <div className="security-note"><span>⌑</span> Your connection is protected with secure authentication.</div>}
            </>
          )}
        </div>
        <footer>© {new Date().getFullYear()} SaarthOps <span>·</span> Built for teams</footer>
      </section>
    </main>
  );
}
