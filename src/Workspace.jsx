import { useEffect, useMemo, useState } from "react";
import RolePermissionsScreen from "./RolePermissionsScreen.jsx";
import UsersScreen from "./UsersScreen.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function getScreens() {
  const token = sessionStorage.getItem("saarthops.access-token");
  const response = await fetch(`${API_BASE}/api/v1/screens`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.description ?? `Could not load screens (${response.status})`);
  }
  return payload.data;
}

function EmptyScreen({ title, moduleName }) {
  return (
    <section className="workspace-empty">
      <div className="empty-illustration"><span>{title.slice(0, 1)}</span></div>
      <span className="eyebrow">{moduleName.toUpperCase()}</span>
      <h2>{title}</h2>
      <p>This workspace screen is ready for its feature. There’s nothing to manage here yet.</p>
      <span className="coming-soon-badge">FEATURE NOT CONFIGURED</span>
    </section>
  );
}

function DashboardScreen({ user, screens, childrenByParent, onOpenScreen }) {
  const activeScreens = screens.reduce((total, screen) => total + (childrenByParent.get(screen.id)?.length ?? 0), 0);
  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h2>Good to see you, {user.first_name}.</h2>
          <p>Choose a workspace area to get started. Your screens are ready to explore.</p>
        </div>
        <div className="dashboard-orbit"><img src="/assets/SaarthOps.jpeg" alt="SaarthOps" /></div>
      </section>
      <div className="dashboard-stats">
        <article><span>Workspace areas</span><strong>{screens.length}</strong><small>Available areas</small></article>
        <article><span>Configured screens</span><strong>{activeScreens}</strong><small>Ready to open</small></article>
        <article><span>Signed in as</span><strong className="dashboard-user-status">Active</strong><small>{user.email}</small></article>
      </div>
      <div className="workspace-section-heading">
        <div><span className="eyebrow">GET STARTED</span><h3>Explore your workspace</h3></div>
      </div>
      <div className="module-shortcuts">
        {screens.slice(0, 6).map((screen) => {
          const children = childrenByParent.get(screen.id) ?? [];
          return (
          <button key={screen.code} className="module-shortcut" onClick={() => onOpenScreen(screen)}>
            <span className="shortcut-icon">{screen.name.slice(0, 1)}</span>
            <span><strong>{screen.name}</strong><small>{children.length
              ? `${children.length} screens`
              : screen.code === "DASHBOARD" ? "Workspace overview" : "Open screen"}</small></span>
            <span className="shortcut-arrow">→</span>
          </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Workspace({ user, onLogout }) {
  const [screens, setScreens] = useState([]);
  const [selectedParent, setSelectedParent] = useState("DASHBOARD");
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [expandedScreens, setExpandedScreens] = useState(new Set(["CRM", "TEAM_MANAGEMENT"]));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getScreens()
      .then((catalog) => {
        if (!active) return;
        setScreens(catalog.sort((a, b) => a.display_order - b.display_order));
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const rootScreens = useMemo(
    () => screens.filter((screen) => !screen.parent_id),
    [screens]
  );
  const childrenByParent = useMemo(() => {
    const children = new Map();
    screens.filter((screen) => screen.parent_id).forEach((screen) => {
      const current = children.get(screen.parent_id) ?? [];
      current.push(screen);
      children.set(screen.parent_id, current);
    });
    return children;
  }, [screens]);
  const activeParent = useMemo(
    () => rootScreens.find((screen) => screen.code === selectedParent),
    [rootScreens, selectedParent]
  );
  const activeScreen = screens.find((screen) => screen.code === selectedScreen);

  function openScreen(screen) {
    if (screen.parent_id) {
      const parent = screens.find((item) => item.id === screen.parent_id);
      if (parent) setSelectedParent(parent.code);
      setSelectedScreen(screen.code);
      return;
    }
    setSelectedParent(screen.code);
    setSelectedScreen(null);
    if ((childrenByParent.get(screen.id)?.length ?? 0) > 0) {
      setExpandedScreens((current) => new Set(current).add(screen.code));
    }
  }

  function toggleScreen(screen) {
    const children = childrenByParent.get(screen.id) ?? [];
    if (children.length === 0) {
      openScreen(screen);
      return;
    }
    setSelectedParent(screen.code);
    setSelectedScreen(null);
    setExpandedScreens((current) => {
      const next = new Set(current);
      if (next.has(screen.code)) next.delete(screen.code);
      else next.add(screen.code);
      return next;
    });
  }

  return (
    <main className="workspace-layout">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <img className="workspace-brand-logo" src="/assets/SaarthOps.jpeg" alt="" />
          <span>Saarth<span className="brand-light">Ops</span></span>
        </div>
        <div className="workspace-nav-label">WORKSPACE</div>
        <nav className="workspace-nav" aria-label="Workspace screens">
          {loading && <div className="nav-loading">Loading screens…</div>}
          {rootScreens.map((screen) => {
            const children = childrenByParent.get(screen.id) ?? [];
            const hasChildren = children.length > 0;
            const expanded = expandedScreens.has(screen.code);
            const active = selectedParent === screen.code;
            return (
              <div className="nav-module" key={screen.code}>
                <button
                  className={`nav-module-button${active ? " active" : ""}`}
                  onClick={() => toggleScreen(screen)}
                  aria-expanded={hasChildren ? expanded : undefined}
                >
                  <span className={`nav-module-icon icon-${screen.code.toLowerCase()}`}>
                    {screen.code === "DASHBOARD" ? "▦" : screen.name.slice(0, 1)}
                  </span>
                  <span className="nav-module-name">{screen.name}</span>
                  {hasChildren && <span className={`nav-chevron${expanded ? " expanded" : ""}`}>›</span>}
                </button>
                {hasChildren && expanded && (
                  <div className="nav-screens">
                    {children.map((child) => (
                      <button
                        key={child.code}
                        className={`nav-screen${active && selectedScreen === child.code ? " active" : ""}`}
                        onClick={() => openScreen(child)}
                      >
                        <span className="nav-screen-dot" />
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <span className="user-avatar">{user.first_name?.slice(0, 1) ?? "U"}</span>
          <span className="sidebar-user-copy"><strong>{user.first_name} {user.last_name ?? ""}</strong><small>{user.email}</small></span>
          <button className="sidebar-logout" aria-label="Sign out" title="Sign out" onClick={onLogout}>↗</button>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-topbar">
          <div className="breadcrumbs">
            <span>Workspace</span><b>/</b><strong>{activeScreen?.name ?? activeParent?.name ?? "Dashboard"}</strong>
          </div>
          <div className="topbar-user"><span className="online-dot" /> {user.email}</div>
        </header>
        <div className="workspace-content">
          {error && <div className="notice error-notice" role="alert">{error}</div>}
          {loading && <div className="workspace-loading"><span className="spinner" /> Loading workspace…</div>}
          {!loading && !error && activeParent?.code === "DASHBOARD" && (
            <DashboardScreen user={user} screens={rootScreens} childrenByParent={childrenByParent} onOpenScreen={openScreen} />
          )}
          {!loading && !error && activeParent?.code === "TEAM_MANAGEMENT"
            && activeScreen?.code === "TEAM_MANAGEMENT_ROLES_PERMISSIONS" && <RolePermissionsScreen />}
          {!loading && !error && activeParent?.code === "TEAM_MANAGEMENT"
            && activeScreen?.code === "TEAM_MANAGEMENT_USERS" && <UsersScreen />}
          {!loading && !error && activeScreen
            && !(activeParent?.code === "TEAM_MANAGEMENT"
              && ["TEAM_MANAGEMENT_ROLES_PERMISSIONS", "TEAM_MANAGEMENT_USERS"].includes(activeScreen.code)) && (
              <EmptyScreen title={activeScreen.name} moduleName={activeParent?.name ?? "Workspace"} />
            )}
          {!loading && !error && activeParent && !activeScreen && activeParent.code !== "DASHBOARD" && (
            <EmptyScreen title={activeParent.name} moduleName="Workspace screen" />
          )}
          {!loading && !error && !activeParent && <EmptyScreen title="Workspace" moduleName="Workspace" />}
        </div>
      </section>
    </main>
  );
}
