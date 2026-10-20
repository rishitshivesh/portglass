import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Command,
  Eye,
  Layers,
  Lock,
  Network,
  PanelLeft,
  Radio,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  X,
} from "lucide-react";
import type { Process, Listener, Snapshot } from "./types";
import "./style.css";

type Page = "Overview" | "Ports" | "Processes" | "AI Agents" | "Collectors";
const nav = [
  { name: "Overview", icon: Layers },
  { name: "Ports", icon: Network },
  { name: "Processes", icon: Terminal },
  { name: "AI Agents", icon: Sparkles },
  { name: "Collectors", icon: Settings },
] as const;
const formatMem = (n: number) =>
  n >= 1024 ? `${(n / 1024).toFixed(1)} GB` : `${n.toFixed(0)} MB`;
const clock = (t: number) =>
  new Date(t * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

function App() {
  const [page, setPage] = useState<Page>("Overview"),
    [data, setData] = useState<Snapshot | null>(null),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [auto, setAuto] = useState(true),
    [processesEnabled, setProcessesEnabled] = useState(true),
    [portsEnabled, setPortsEnabled] = useState(true),
    [selected, setSelected] = useState<Process | Listener | null>(null);
  const search = useRef<HTMLInputElement>(null),
    busy = useRef(false),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    if (busy.current || !isTauri()) return;
    busy.current = true;
    setLoading(true);
    const revision = generation.current;
    try {
      const result = await invoke<Snapshot>("snapshot", {
        processesEnabled,
        portsEnabled,
      });
      if (revision === generation.current) {
        setData(result);
        setError("");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [processesEnabled, portsEnabled]);
  useEffect(() => {
    void refresh();
    const tick = window.setInterval(() => {
      if (auto && document.visibilityState === "visible") void refresh();
    }, 10000);
    return () => clearInterval(tick);
  }, [refresh, auto]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.key === "Escape") {
        setSelected(null);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const toggle = (kind: "processes" | "ports") => {
    generation.current++;
    setSelected(null);
    setData(null);
    if (kind === "processes") setProcessesEnabled((v) => !v);
    else setPortsEnabled((v) => !v);
  };
  const match = (v: unknown) =>
    String(v).toLowerCase().includes(query.toLowerCase());
  const processes = (data?.processes ?? []).filter((p) =>
    [p.name, p.pid, p.uid, p.agent ?? ""].some(match),
  );
  const listeners = (data?.listeners ?? []).filter((p) =>
    [p.name, p.pid, p.port, p.address].some(match),
  );
  const agents = processes.filter((p) => p.agent),
    allAgents = data?.processes.filter((p) => p.agent) ?? [];
  const top = [...(data?.processes ?? [])]
    .sort((a, b) => b.memoryMb - a.memoryMb)
    .slice(0, 5);
  const observed = data ? clock(data.capturedAt) : "Not observed";
  const totalMem = data?.processes.reduce((s, p) => s + p.memoryMb, 0) ?? 0;
  const go = (next: Page) => {
    setPage(next);
    setQuery("");
    setSelected(null);
  };
  const portList = (limit?: number) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>PORT / ADDRESS</th>
            <th>PROCESS</th>
            <th>PID</th>
            <th>PROTOCOL</th>
            <th>OBSERVATION</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {listeners.slice(0, limit).map((p) => (
            <tr key={p.id} onClick={() => setSelected(p)}>
              <td>
                <button className="port-link" onClick={() => setSelected(p)}>
                  :{p.port}
                </button>
                <span className="address">{p.address}</span>
              </td>
              <td>
                <span className="app-icon">
                  <Terminal size={13} />
                </span>
                {p.name || "Unknown owner"}
              </td>
              <td className="mono muted">{p.pid || "Unknown"}</td>
              <td>
                <span className="chip">TCP · {p.family || "Unknown"}</span>
              </td>
              <td>
                <span className="status-dot" /> Listening
              </td>
              <td>
                <button
                  className="icon-btn"
                  aria-label={`Inspect port ${p.port}`}
                  onClick={() => setSelected(p)}
                >
                  <ChevronRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {listeners.length === 0 && (
        <Empty
          title={
            portsEnabled
              ? "No visible listeners"
              : "Listener collection disabled"
          }
          text={
            data
              ? "No matching listeners in this observation. Permissions may limit visibility."
              : "Open the desktop app to collect a real snapshot."
          }
        />
      )}
    </div>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">
            <Layers size={22} />
          </div>
          <span>
            portglass<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="workspace">
          <div className="machine-icon">
            <Terminal size={18} />
          </div>
          <div>
            <strong>Local machine</strong>
            <small>macOS workspace</small>
          </div>
          <span className="status-dot" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "nav active" : "nav"}
              onClick={() => go(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "AI Agents" && allAgents.length > 0 && (
                <b>{allAgents.length}</b>
              )}
              {name === "Ports" && data && (
                <small>{data.listeners.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy">
            <ShieldCheck size={18} />
            <div>
              <strong>Your machine. Your data.</strong>
              <p>Local only. Read-only by default.</p>
            </div>
          </div>
          <div className="version">
            <span>
              <i /> Portglass v0.1
            </span>
            <span>MACOS</span>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="crumb">
            <PanelLeft size={17} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="top-right">
            <span className="readonly">
              <Lock size={12} /> Read-only
            </span>
            <span className="local">
              <i /> Local connection
            </span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div className="eyebrow">YOUR DEVELOPMENT ENVIRONMENT</div>
            <div className="title-row">
              <div>
                <h1>
                  {page === "Overview"
                    ? "Your machine, under the glass."
                    : page === "Ports"
                      ? "Every listener. A clearer picture."
                      : page === "Processes"
                        ? "What’s running right now."
                        : page === "AI Agents"
                          ? "Agents, with evidence."
                          : "Observation, on your terms."}
                </h1>
                <p>
                  {page === "Overview"
                    ? "A live look at your ports, processes, and AI agents. All in one place."
                    : page === "Collectors"
                      ? "Control what Portglass observes. Sensitive integrations stay off."
                      : "Inspect the metadata your machine makes visible. Nothing inferred as certainty."}
                </p>
              </div>
              <button
                className="refresh"
                disabled={loading || !isTauri()}
                onClick={() => void refresh()}
              >
                <RefreshCw size={15} className={loading ? "spin" : ""} />
                {loading ? "Observing…" : "Refresh"}
                <span>↵</span>
              </button>
            </div>
          </div>
          {!isTauri() && (
            <div className="notice">
              <Eye size={17} />
              <span>
                <strong>Desktop connection required.</strong> This browser
                preview shows the interface without machine access. Run{" "}
                <code>npm run desktop</code> for live observations.
              </span>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          <div className="search-row">
            <label className="search">
              <Search size={17} />
              <input
                ref={search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a port, process, PID, or agent…"
                aria-label="Search observations"
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className={"live-toggle " + (auto ? "on" : "")}
              onClick={() => setAuto((v) => !v)}
            >
              <Radio size={15} />
              {auto ? "Auto-refresh on" : "Auto-refresh paused"}
            </button>
          </div>
          {page === "Overview" && (
            <>
              <section className="metrics">
                <Metric
                  icon={<Network size={18} />}
                  label="TCP listeners"
                  value={data ? String(data.listeners.length) : "—"}
                  detail="Visible listening endpoints"
                  tint="mint"
                />
                <Metric
                  icon={<Terminal size={18} />}
                  label="Processes"
                  value={data ? String(data.processes.length) : "—"}
                  detail="Observed process identities"
                  tint="blue"
                />
                <Metric
                  icon={<Sparkles size={18} />}
                  label="AI agent processes"
                  value={data ? String(allAgents.length) : "—"}
                  detail="Detected · activity unverified"
                  tint="purple"
                />
                <Metric
                  icon={<Activity size={18} />}
                  label="Process memory"
                  value={data ? formatMem(totalMem) : "—"}
                  detail="Sum of RSS · shared pages may overlap"
                  tint="amber"
                />
              </section>
              <div className="section-heading">
                <div>
                  <h2>
                    Listening ports <span>{data?.listeners.length ?? "—"}</span>
                  </h2>
                  <p>Know what’s behind your localhost.</p>
                </div>
                <button className="text-button" onClick={() => go("Ports")}>
                  View all ports <ArrowUpRight size={15} />
                </button>
              </div>
              <section className="card">
                {portList(6)}
                <div className="card-foot">
                  <ShieldCheck size={13} />
                  <span>
                    Observation only. No process controls are enabled.
                  </span>
                  <span className="push">Source: macOS lsof</span>
                </div>
              </section>
              <div className="bottom-grid">
                <section className="card">
                  <div className="card-title">
                    <h2>
                      <Sparkles size={17} /> AI agent discovery
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => go("AI Agents")}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {allAgents.length ? (
                    allAgents
                      .slice(0, 3)
                      .map((p) => (
                        <Agent
                          key={p.id}
                          process={p}
                          inspect={() => setSelected(p)}
                        />
                      ))
                  ) : (
                    <Empty
                      title="No agent processes observed"
                      text="Exact executable signatures only. A process is not proof of an active session."
                    />
                  )}
                  <div className="card-foot">
                    <Lock size={12} />
                    No prompts, transcripts, or session files accessed.
                  </div>
                </section>
                <section className="card">
                  <div className="card-title">
                    <h2>
                      <Activity size={17} /> Memory consumers
                    </h2>
                    <span className="tiny muted">CURRENT RSS</span>
                  </div>
                  {top.length ? (
                    top.map((p) => (
                      <button
                        className="consumer"
                        key={p.id}
                        onClick={() => setSelected(p)}
                      >
                        <span className="app-icon">
                          <Terminal size={13} />
                        </span>
                        <span>
                          {p.name}
                          <small>PID {p.pid}</small>
                        </span>
                        <div className="bar">
                          <i
                            style={{
                              width: `${Math.max(3, (p.memoryMb / Math.max(top[0].memoryMb, 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <strong>{formatMem(p.memoryMb)}</strong>
                      </button>
                    ))
                  ) : (
                    <Empty
                      title="Awaiting an observation"
                      text="Resource values will appear after the first desktop snapshot."
                    />
                  )}
                </section>
              </div>
            </>
          )}
          {page === "Ports" && (
            <section className="card">
              {portList()}
              <div className="card-foot">
                TCP listening snapshots · IPv4 and IPv6 are separate endpoints ·
                source: lsof
              </div>
            </section>
          )}
          {page === "Processes" && (
            <section className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>EXECUTABLE</th>
                      <th>PID / PARENT</th>
                      <th>OWNER UID</th>
                      <th>CPU AVG.</th>
                      <th>
                        MEMORY RSS <ArrowDown size={12} />
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...processes]
                      .sort((a, b) => b.memoryMb - a.memoryMb)
                      .map((p) => (
                        <tr key={p.id} onClick={() => setSelected(p)}>
                          <td>
                            <button
                              className="port-link"
                              onClick={() => setSelected(p)}
                            >
                              {p.name}
                            </button>
                          </td>
                          <td className="mono">
                            {p.pid}
                            <span className="address">parent {p.parent}</span>
                          </td>
                          <td className="mono muted">{p.uid}</td>
                          <td className="mono">{p.cpu.toFixed(1)}%</td>
                          <td className="mono">{formatMem(p.memoryMb)}</td>
                          <td>
                            <button
                              className="icon-btn"
                              aria-label={`Inspect process ${p.pid}`}
                              onClick={() => setSelected(p)}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {processes.length === 0 && (
                  <Empty
                    title="No matching processes"
                    text="Check your search or enable the process collector."
                  />
                )}
              </div>
            </section>
          )}
          {page === "AI Agents" && (
            <>
              <div className="notice">
                <ShieldCheck size={17} />
                <span>
                  <strong>Detected does not mean active.</strong> Provider
                  sessions, models, token usage, and project attribution are not
                  observed in this release.
                </span>
              </div>
              <section className="agent-grid">
                {agents.map((p) => (
                  <section key={p.id} className="card agent-full">
                    <Agent process={p} inspect={() => setSelected(p)} />
                    <dl>
                      <dt>Process</dt>
                      <dd>
                        {p.name} · {p.pid}
                      </dd>
                      <dt>Memory RSS</dt>
                      <dd>{formatMem(p.memoryMb)}</dd>
                      <dt>Evidence</dt>
                      <dd>Exact executable basename</dd>
                      <dt>Activity</dt>
                      <dd>Unverified</dd>
                      <dt>Project / model</dt>
                      <dd>Not observed</dd>
                    </dl>
                  </section>
                ))}
              </section>
              {!agents.length && (
                <section className="card">
                  <Empty
                    title="No matching agent processes"
                    text="Codex, Claude Code, Gemini CLI, and OpenCode executable signatures are supported. Node-hosted agents may remain undetected."
                  />
                </section>
              )}
            </>
          )}
          {page === "Collectors" && (
            <>
              <section className="card settings">
                <h2>Host metadata</h2>
                <p>
                  Fixed, bounded system commands. No administrator privileges or
                  background daemon.
                </p>
                <div className="setting">
                  <div>
                    <strong>Processes & agent discovery</strong>
                    <p>
                      PID, parent, numeric UID, start time, basename, CPU
                      average and RSS.
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={processesEnabled}
                    className={"switch " + (processesEnabled ? "checked" : "")}
                    onClick={() => toggle("processes")}
                    aria-label="Enable process collection"
                  >
                    <i />
                  </button>
                </div>
                <div className="setting">
                  <div>
                    <strong>TCP listeners</strong>
                    <p>
                      Listening addresses, address family, port and visible
                      owner metadata.
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={portsEnabled}
                    className={"switch " + (portsEnabled ? "checked" : "")}
                    onClick={() => toggle("ports")}
                    aria-label="Enable TCP listener collection"
                  >
                    <i />
                  </button>
                </div>
              </section>
              <section className="card settings">
                <h2>Collector capabilities</h2>
                {data?.capabilities.map((c) => (
                  <div className="capability" key={c.name}>
                    <div>
                      <strong>{c.name}</strong>
                      <p>{c.detail}</p>
                    </div>
                    <span className="chip">{c.state}</span>
                  </div>
                ))}
                {!data && <p>Awaiting desktop snapshot.</p>}
                <div className="capability">
                  <div>
                    <strong>
                      Docker · Homebrew · Redis · Provider metadata
                    </strong>
                    <p>Deferred. No connections, hooks, or file reads.</p>
                  </div>
                  <span className="chip">Not enabled</span>
                </div>
              </section>
            </>
          )}
          <footer>
            <span>
              <ShieldCheck size={13} />
              Read-only by design
            </span>
            <span>
              {data
                ? `Observed ${observed} · ${data.durationMs} ms collection`
                : "No machine snapshot collected"}
              <i />
              Updates every 10s while visible
            </span>
          </footer>
        </div>
      </main>
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Resource inspector"
            className="drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <span>RESOURCE INSPECTOR</span>
              <button
                autoFocus
                className="icon-btn"
                aria-label="Close inspector"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="inspect-icon">
              {"port" in selected ? (
                <Network size={26} />
              ) : (
                <Terminal size={26} />
              )}
            </div>
            <h2>
              {"port" in selected ? `Port ${selected.port}` : selected.name}
            </h2>
            <p className="muted">Metadata observed at {observed}</p>
            <dl>
              {Object.entries(
                "port" in selected
                  ? {
                      Protocol: `TCP / ${selected.family}`,
                      Address: selected.address,
                      Process: selected.name || "Unknown",
                      PID: selected.pid,
                      Owner: selected.uid || "Unknown",
                      Source: "macOS lsof",
                      Visibility: "Limited by OS permissions",
                    }
                  : {
                      Executable: selected.name,
                      PID: selected.pid,
                      "Parent PID": selected.parent,
                      "Owner UID": selected.uid,
                      "Started (host local)": selected.started,
                      "CPU (lifetime average)": `${selected.cpu}%`,
                      "Memory RSS": formatMem(selected.memoryMb),
                      Agent: selected.agent
                        ? `${selected.agent} · detected, activity unverified`
                        : "Not detected",
                      Source: "macOS ps",
                    },
              ).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            <div className="notice">
              <Lock size={17} />
              <span>
                Read-only inspection. Stopping processes and changing services
                are deferred until identity and impact checks are implemented.
              </span>
            </div>
            <p className="tiny muted">
              No arguments, full paths, environment values, or session content
              collected.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  detail,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tint: string;
}) {
  return (
    <div className={"metric " + tint}>
      <div className="metric-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Workflow size={23} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
function Agent({
  process,
  inspect,
}: {
  process: Process;
  inspect: () => void;
}) {
  return (
    <button className="agent" onClick={inspect}>
      <div className="agent-avatar">
        <Sparkles size={20} />
      </div>
      <div>
        <strong>{process.agent}</strong>
        <small>
          PID {process.pid} · {formatMem(process.memoryMb)}
        </small>
      </div>
      <span className="agent-status">
        Detected <ChevronRight size={13} />
      </span>
    </button>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
