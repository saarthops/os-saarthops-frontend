import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const blankUser = {
  id: null,
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  mobile: "",
  password: "",
  role_id: "",
  status: "INVITED"
};

async function request(path, { method = "GET", body } = {}) {
  const token = sessionStorage.getItem("saarthops.access-token");
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(payload?.description ?? payload?.message ?? `Request failed (${response.status})`);
  }
  return payload;
}

export default function UsersScreen() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(blankUser);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadData() {
    const [userResult, roleResult] = await Promise.all([
      request("/api/v1/users"),
      request("/api/v1/roles")
    ]);
    setUsers(userResult.data);
    setRoles(roleResult.data.filter((role) => role.status === "ACTIVE"));
  }

  useEffect(() => {
    let active = true;
    loadData()
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function startCreate() {
    setForm({ ...blankUser, role_id: roles[0]?.id ?? "" });
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function startEdit(user) {
    setForm({
      ...blankUser,
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name ?? "",
      username: user.username ?? "",
      email: user.email,
      mobile: user.mobile ?? "",
      role_id: user.role_id,
      status: user.status
    });
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function saveUser(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const isEdit = Boolean(form.id);
    const body = {
      first_name: form.first_name,
      last_name: form.last_name || null,
      username: form.username || null,
      email: form.email,
      mobile: form.mobile || null,
      role_id: form.role_id,
      status: form.status,
      ...(!isEdit || form.password ? { password: form.password } : {})
    };
    try {
      await request(isEdit ? `/api/v1/users/${form.id}` : "/api/v1/users", {
        method: isEdit ? "PUT" : "POST",
        body
      });
      await loadData();
      setFormOpen(false);
      setNotice(isEdit ? "User updated." : "User created.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete ${user.first_name} ${user.last_name ?? ""}? Their active sessions will be revoked.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/v1/users/${user.id}`, { method: "DELETE" });
      await loadData();
      setNotice("User deleted.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="users-screen">
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">TEAM MANAGEMENT</span>
          <h2>Users</h2>
          <p className="subtitle">Invite and manage the people in your workspace.</p>
        </div>
        <button className="primary-button add-user-button" disabled={!roles.length || loading} onClick={startCreate}>
          + Add user
        </button>
      </div>

      {notice && <div className="notice success-notice" role="status">{notice}</div>}
      {error && <div className="notice error-notice" role="alert">{error}</div>}

      {formOpen && (
        <form className="user-form" onSubmit={saveUser}>
          <div className="user-form-heading">
            <div><h3>{form.id ? "Edit user" : "Add a team member"}</h3><p>Password is required for new users.</p></div>
            <button type="button" className="icon-button" aria-label="Close form" onClick={() => setFormOpen(false)}>×</button>
          </div>
          <div className="user-form-grid">
            <label className="field"><span>First name</span><input required maxLength={50} value={form.first_name} onChange={(event) => update("first_name", event.target.value)} /></label>
            <label className="field"><span>Last name</span><input maxLength={50} value={form.last_name} onChange={(event) => update("last_name", event.target.value)} /></label>
            <label className="field"><span>Email</span><input type="email" required maxLength={191} value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label className="field"><span>Username <small>Optional</small></span><input maxLength={50} value={form.username} onChange={(event) => update("username", event.target.value)} /></label>
            <label className="field"><span>Mobile <small>Optional</small></span><input maxLength={20} value={form.mobile} onChange={(event) => update("mobile", event.target.value)} /></label>
            <label className="field"><span>Role</span>
              <select required value={form.role_id} onChange={(event) => update("role_id", event.target.value)}>
                <option value="" disabled>Select a role</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
            <label className="field"><span>{form.id ? "New password" : "Initial password"} <small>{form.id ? "Leave blank to keep current" : "Required"}</small></span>
              <input type="password" required={!form.id} minLength={12} maxLength={72} autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} />
            </label>
            <label className="field"><span>Status</span>
              <select value={form.status} onChange={(event) => update("status", event.target.value)}>
                {(form.id ? ["ACTIVE", "INVITED", "SUSPENDED"] : ["ACTIVE", "INVITED"]).map((status) => (
                  <option key={status} value={status}>{status[0] + status.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="user-form-actions">
            <button className="primary-button" disabled={busy || !roles.length}>{busy ? "Saving…" : "Save user"}</button>
            <button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="users-table-card">
        <div className="table-card-heading"><div><h3>Workspace members</h3><p>{users.length} {users.length === 1 ? "person" : "people"}</p></div></div>
        {loading ? <div className="workspace-loading"><span className="spinner" /> Loading users…</div>
          : users.length === 0 ? <p className="empty-state">No users found. Add a team member to get started.</p>
            : (
              <div className="table-scroll">
                <table className="users-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td><div className="table-user"><span className="user-avatar">{user.first_name.slice(0, 1)}</span><strong>{user.first_name} {user.last_name ?? ""}</strong></div></td>
                        <td>{user.email}</td>
                        <td>{user.role_name}</td>
                        <td><span className={`user-status status-${user.status.toLowerCase()}`}>{user.status}</span></td>
                        <td><div className="table-actions">
                          <button className="text-button" onClick={() => startEdit(user)}>Edit</button>
                          <button className="text-button danger-button" disabled={busy} onClick={() => deleteUser(user)}>Delete</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>
    </section>
  );
}
