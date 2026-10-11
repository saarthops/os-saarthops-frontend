import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

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

const emptyRole = { id: null, name: "", description: "", status: "ACTIVE" };

export default function RolePermissionsScreen() {
  const [roles, setRoles] = useState([]);
  const [screens, setScreens] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [editingRole, setEditingRole] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadRoles(preferredId) {
    const result = await request("/api/v1/roles");
    setRoles(result.data);
    const nextId = preferredId ?? selectedRole;
    if (nextId && result.data.some((role) => role.id === nextId)) {
      setSelectedRole(nextId);
    } else {
      setSelectedRole(result.data[0]?.id ?? null);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([request("/api/v1/roles"), request("/api/v1/screens")])
      .then(([roleResult, screenResult]) => {
        if (!active) return;
        setRoles(roleResult.data);
        setSelectedRole(roleResult.data[0]?.id ?? null);
        setScreens(screenResult.data);
      })
      .catch((requestError) => active && setError(requestError.message));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedRole) {
      setPermissions([]);
      return undefined;
    }
    let active = true;
    request(`/api/v1/roles/${selectedRole}/permissions`)
      .then((result) => active && setPermissions(result.data))
      .catch((requestError) => active && setError(requestError.message));
    return () => {
      active = false;
    };
  }, [selectedRole]);

  function startCreate() {
    setRoleForm(emptyRole);
    setEditingRole(true);
    setError("");
    setNotice("");
  }

  function startEdit(role) {
    setRoleForm({ id: role.id, name: role.name, description: role.description ?? "", status: role.status });
    setEditingRole(true);
    setError("");
    setNotice("");
  }

  async function saveRole(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const isEdit = Boolean(roleForm.id);
      const result = await request(isEdit ? `/api/v1/roles/${roleForm.id}` : "/api/v1/roles", {
        method: isEdit ? "PUT" : "POST",
        body: { name: roleForm.name, description: roleForm.description || null, ...(isEdit ? { status: roleForm.status } : {}) }
      });
      await loadRoles(result.data.id);
      setEditingRole(false);
      setNotice(isEdit ? "Role updated." : "Role created.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function decommissionRole(role) {
    if (!window.confirm(`Decommission the role "${role.name}"?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/v1/roles/${role.id}`, { method: "DELETE" });
      await loadRoles();
      setNotice("Role decommissioned.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function togglePermission(name) {
    setPermissions((current) => current.includes(name)
      ? current.filter((permission) => permission !== name)
      : [...current, name]);
  }

  async function savePermissions() {
    if (!selectedRole) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request(`/api/v1/roles/${selectedRole}/permissions`, {
        method: "PUT",
        body: { permission_names: permissions }
      });
      setPermissions(result.data);
      setNotice("Screen permissions saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="role-manager">
      <div className="role-manager-heading">
        <div>
          <span className="eyebrow">TEAM MANAGEMENT</span>
          <h2>Roles &amp; permissions</h2>
          <p className="subtitle">Choose a role, then set access for each screen.</p>
        </div>
        <button className="secondary-button" onClick={startCreate}>+ New role</button>
      </div>

      {notice && <div className="notice success-notice" role="status">{notice}</div>}
      {error && <div className="notice error-notice" role="alert">{error}</div>}

      {editingRole && (
        <form className="role-form" onSubmit={saveRole}>
          <h3>{roleForm.id ? "Edit role" : "Create role"}</h3>
          <label className="field">
            <span>Role name</span>
            <input
              value={roleForm.name}
              onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
              maxLength={50}
              required
            />
          </label>
          <label className="field">
            <span>Description</span>
            <input
              value={roleForm.description}
              onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
              maxLength={255}
            />
          </label>
          {roleForm.id && (
            <label className="field">
              <span>Status</span>
              <select
                value={roleForm.status}
                onChange={(event) => setRoleForm({ ...roleForm, status: event.target.value })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          )}
          <div className="role-form-actions">
            <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save role"}</button>
            <button type="button" className="secondary-button" onClick={() => setEditingRole(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="role-list">
        {roles.length === 0
          ? <p className="empty-state">No custom roles yet. Create a role to assign screen access.</p>
          : roles.map((role) => (
            <article className={`role-card${selectedRole === role.id ? " selected" : ""}`} key={role.id}>
              <button className="role-select" onClick={() => setSelectedRole(role.id)}>
                <span className="role-name">{role.name}</span>
                <span className={`role-status ${role.status.toLowerCase()}`}>{role.status}</span>
                {role.description && <span className="role-description">{role.description}</span>}
              </button>
              <div className="role-actions">
                <button className="text-button" onClick={() => startEdit(role)}>Edit</button>
                <button className="text-button danger-button" disabled={busy} onClick={() => decommissionRole(role)}>Decommission</button>
              </div>
            </article>
          ))}
      </div>

      {selectedRole && (
        <div className="permission-editor">
          <div className="permission-heading">
            <div>
              <h3>Screen access</h3>
              <p className="hint">Changes apply only after saving.</p>
            </div>
            <button className="primary-button save-permissions" disabled={busy} onClick={savePermissions}>
              {busy ? "Saving…" : "Save access"}
            </button>
          </div>

          {screens.filter((screen) => !screen.parent_id).map((parentScreen) => {
            const childScreens = screens.filter((screen) => screen.parent_id === parentScreen.id);
            const visibleScreens = [...(parentScreen.permissions?.length ? [parentScreen] : []), ...childScreens];
            if (!visibleScreens.length) return null;
            return (
              <section className="module-permissions" key={parentScreen.code}>
                <h4><span>{parentScreen.name}</span><small>{parentScreen.display_order}</small></h4>
                {visibleScreens.map((screen) => (
                  <div className="screen-permissions" key={screen.code}>
                    <div className="screen-label">{screen.name}</div>
                    <div className="permission-options">
                      {(screen.permissions ?? []).map((permission) => (
                        <label className="permission-option" key={permission.name}>
                          <input
                            type="checkbox"
                            checked={permissions.includes(permission.name)}
                            onChange={() => togglePermission(permission.name)}
                          />
                          <span>{permission.action}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
          {!screens.some((screen) => screen.permissions?.length)
            && !screens.some((screen) => screen.parent_id) && (
            <p className="empty-state">No screens are configured in the permission catalog.</p>
          )}
        </div>
      )}
    </section>
  );
}
