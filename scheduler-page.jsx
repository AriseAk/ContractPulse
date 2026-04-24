"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Activity, AlertTriangle, CheckCircle, Clock, Users,
  ChevronDown, ArrowRight, Zap, Calendar, Building2,
  TrendingDown, RefreshCw, X, Bell, Shield
} from "lucide-react";

/* ─── Intersection reveal hook ─── */
function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── Severity config ─── */
const SEV = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", icon: "⚡", label: "CRITICAL" },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)", icon: "🔥", label: "HIGH" },
  MEDIUM:   { color: "#C0B298", bg: "rgba(192,178,152,0.12)", border: "rgba(192,178,152,0.35)", icon: "⚠", label: "MEDIUM" },
  LOW:      { color: "#86efac", bg: "rgba(134,239,172,0.12)", border: "rgba(134,239,172,0.35)", icon: "●", label: "LOW" },
};

/* ─── API base ─── */
const API = "http://localhost:5000/api";

/* ─── Mock breach forms ─── */
const OBLIGATION_TYPES = [
  "revenue","debt_to_equity_ratio","current_ratio","report_submission",
  "workforce_size","capex_limit","liquidity_ratio","insurance_coverage","unknown"
];

const PRESETS = [
  {
    contract_id: "CTR-001", obligation_type: "revenue", metric_name: "revenue",
    threshold_value: 5000000, current_value: 3800000, predicted_value: 3500000,
    deadline: "annually", consequence: "termination", conflict_with: ""
  },
  {
    contract_id: "CTR-002", obligation_type: "debt_to_equity_ratio", metric_name: "debt_to_equity_ratio",
    threshold_value: 2.5, current_value: 2.8, predicted_value: 3.1,
    deadline: "quarterly", consequence: "default", conflict_with: ""
  },
  {
    contract_id: "CTR-004", obligation_type: "liquidity_ratio", metric_name: "liquidity_ratio",
    threshold_value: 1.2, current_value: 0.9, predicted_value: 0.85,
    deadline: "monthly", consequence: "acceleration", conflict_with: "CTR-005"
  },
];

/* ─── Severity Badge ─── */
function SevBadge({ sev }) {
  const c = SEV[sev] || SEV.LOW;
  return (
    <span style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}`, padding: "2px 10px", borderRadius: 999, fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {c.icon} {c.label}
    </span>
  );
}

/* ─── Department pill ─── */
function DeptPill({ name }) {
  return (
    <span style={{ background: "rgba(192,178,152,0.15)", border: "1px solid rgba(192,178,152,0.3)", color: "#C0B298", padding: "2px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
      {name}
    </span>
  );
}

/* ─── Task Card ─── */
function TaskCard({ task, idx }) {
  const [open, setOpen] = useState(false);
  const c = SEV[task.severity] || SEV.LOW;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)",
        border: `1px solid ${c.border}`, borderRadius: 24,
        padding: "20px 24px", transition: "all 0.3s", cursor: "pointer",
        animationDelay: `${idx * 80}ms`
      }}
      className="task-card"
      onClick={() => setOpen(!open)}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 11, color: "rgba(249,245,239,0.4)", letterSpacing: "0.12em", flexShrink: 0 }}>
            {task.task_id}
          </span>
          <SevBadge sev={task.severity} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: "#f9f5ef", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.title.replace(`[${task.severity}] Breach: `, "")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {task.assigned_to.map(d => <DeptPill key={d} name={d} />)}
          </div>
          <ChevronDown size={14} style={{ color: "#C0B298", transform: open ? "rotate(180deg)" : "none", transition: "0.3s" }} />
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(192,178,152,0.15)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              ["Contract", task.contract_id],
              ["Due By", new Date(task.due_by).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
              ["Created", new Date(task.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
            ].map(([k, v]) => (
              <div key={k}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(249,245,239,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{k}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#f9f5ef" }}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "12px 16px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#C0B298", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Breach Details</p>
            <pre style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(249,245,239,0.7)", whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>
              {task.description}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Meeting Card ─── */
function MeetingCard({ meeting }) {
  return (
    <div style={{
      background: "rgba(192,178,152,0.08)", backdropFilter: "blur(20px)",
      border: "1px solid rgba(192,178,152,0.25)", borderRadius: 20, padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 16
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(192,178,152,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Calendar size={18} style={{ color: "#C0B298" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: "#f9f5ef", marginBottom: 3 }}>{meeting.title}</p>
        <p style={{ fontSize: 11, color: "rgba(249,245,239,0.5)" }}>
          {new Date(meeting.start).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          {" → "}{new Date(meeting.end).toLocaleTimeString("en-IN", { timeStyle: "short" })}
        </p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#C0B298", letterSpacing: "0.1em", textTransform: "uppercase" }}>{meeting.room}</p>
        <p style={{ fontSize: 10, color: "rgba(249,245,239,0.4)", marginTop: 2 }}>{meeting.attendees} attendees</p>
      </div>
    </div>
  );
}

/* ─── Breach Form ─── */
function BreachForm({ onSubmit, loading }) {
  const empty = {
    contract_id: "", obligation_type: "revenue", metric_name: "",
    threshold_value: "", current_value: "", predicted_value: "",
    deadline: "quarterly", consequence: "default", conflict_with: ""
  };
  const [form, setForm] = useState(empty);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const applyPreset = (p) => setForm({ ...p });

  const handleSubmit = () => {
    const payload = {
      ...form,
      threshold_value: parseFloat(form.threshold_value),
      current_value: parseFloat(form.current_value),
      predicted_value: form.predicted_value ? parseFloat(form.predicted_value) : null,
      conflict_with: form.conflict_with || null,
    };
    onSubmit(payload);
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(192,178,152,0.2)",
    borderRadius: 12, padding: "10px 14px", color: "#f9f5ef", fontSize: 13,
    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, width: "100%",
    outline: "none", transition: "border-color 0.2s"
  };

  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: "rgba(249,245,239,0.5)",
    letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 6
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(192,178,152,0.2)", borderRadius: 32, padding: 28 }}>
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 13, color: "#C0B298", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
        ⚡ Quick Fill — Presets
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => applyPreset(p)}
            style={{ background: "rgba(192,178,152,0.12)", border: "1px solid rgba(192,178,152,0.3)", color: "#C0B298", borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {p.contract_id} — {p.obligation_type.split("_")[0].toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {[
          ["Contract ID", "contract_id", "text", "CTR-007"],
          ["Metric Name", "metric_name", "text", "revenue"],
          ["Threshold Value", "threshold_value", "number", "5000000"],
          ["Current Value", "current_value", "number", "3800000"],
          ["Predicted Value", "predicted_value", "number", "optional"],
          ["Deadline", "deadline", "text", "quarterly"],
          ["Consequence", "consequence", "text", "termination"],
          ["Conflict With", "conflict_with", "text", "optional"],
        ].map(([label, key, type, ph]) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            <input type={type} placeholder={ph} value={form[key]} onChange={e => set(key, e.target.value)} style={inputStyle} />
          </div>
        ))}

        <div style={{ gridColumn: "span 2" }}>
          <label style={labelStyle}>Obligation Type</label>
          <select value={form.obligation_type} onChange={e => set("obligation_type", e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
            {OBLIGATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={loading}
        style={{
          marginTop: 20, width: "100%", background: loading ? "rgba(192,178,152,0.5)" : "#C0B298",
          color: "#1a1008", border: "none", borderRadius: 999, padding: "14px 0",
          fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 13,
          letterSpacing: "0.15em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s"
        }}>
        {loading ? "PROCESSING..." : "PROCESS BREACH →"}
      </button>
    </div>
  );
}

/* ─── Stat tile ─── */
function StatTile({ label, value, icon: Icon, accent = "#C0B298" }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: `rgba(192,178,152,0.15)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 28, color: "#f9f5ef", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(249,245,239,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>{label}</p>
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ─── */
export default function SchedulerPage() {
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [deptSummary, setDeptSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [filterSev, setFilterSev] = useState("ALL");

  const { ref: headerRef, inView: headerIn } = useInView();
  const { ref: statsRef, inView: statsIn } = useInView();

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [tRes, mRes, dRes] = await Promise.all([
        fetch(`${API}/tasks`), fetch(`${API}/meetings`), fetch(`${API}/departments`)
      ]);
      const [t, m, d] = await Promise.all([tRes.json(), mRes.json(), dRes.json()]);
      setTasks(t.tasks || []);
      setMeetings(m.meetings || []);
      setDeptSummary(d.summary || {});
    } catch {
      // backend might not be running; ignore
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSingleBreach = async (payload) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/process_breach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.task) {
        setTasks(p => [data.task, ...p]);
        if (data.meeting) setMeetings(p => [data.meeting, ...p]);
        showToast(`Task ${data.task.task_id} created — ${data.task.severity}`);
      } else {
        showToast(data.error || "Error processing breach", false);
      }
    } catch {
      showToast("Cannot reach backend — is Flask running?", false);
    }
    setLoading(false);
  };

  const handleBatchDemo = async () => {
    setBatchLoading(true);
    try {
      const res = await fetch(`${API}/process_batch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ breaches: PRESETS.map(p => ({ ...p, conflict_with: p.conflict_with || null })) }) });
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
        if (data.meetings) setMeetings(data.meetings);
        showToast(`${data.tasks.length} tasks generated from batch`);
      }
    } catch {
      showToast("Cannot reach backend — is Flask running?", false);
    }
    setBatchLoading(false);
  };

  const handleClear = async () => {
    try {
      await fetch(`${API}/reset`, { method: "POST" });
      setTasks([]); setMeetings([]); setDeptSummary({});
      showToast("Scheduler reset", true);
    } catch {
      setTasks([]); setMeetings([]); setDeptSummary({});
    }
  };

  const filteredTasks = filterSev === "ALL" ? tasks : tasks.filter(t => t.severity === filterSev);

  const sevCounts = tasks.reduce((acc, t) => { acc[t.severity] = (acc[t.severity] || 0) + 1; return acc; }, {});

  const clashFont = "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase";
  const revealBase = "transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]";
  const revealIn = "opacity-100 translate-y-0";
  const revealOut = "opacity-0 translate-y-12";

  return (
    <div style={{ background: "#1a1008", minHeight: "100vh", color: "#f9f5ef", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #1a1008; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a1008; }
        ::-webkit-scrollbar-thumb { background: #C0B298; border-radius: 4px; }
        input:focus, select:focus { border-color: rgba(192,178,152,0.6) !important; }
        input::placeholder { color: rgba(249,245,239,0.3); }
        .task-card:hover { background: rgba(255,255,255,0.07) !important; }
        @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .task-card { animation: fadeUp 0.5s ease both; }
        .toast { animation: slideIn 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>

      {/* ── TOAST ── */}
      {toast && (
        <div className="toast" style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, background: toast.ok ? "rgba(192,178,152,0.95)" : "rgba(239,68,68,0.95)", color: toast.ok ? "#1a1008" : "#fff", borderRadius: 999, padding: "12px 22px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", backdropFilter: "blur(20px)", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
          {toast.msg}
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{ borderBottom: "1px solid rgba(192,178,152,0.1)", padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(26,16,8,0.8)", backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={20} style={{ color: "#C0B298" }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f9f5ef" }}>CONTRACTPULSE</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#C0B298", background: "rgba(192,178,152,0.15)", border: "1px solid rgba(192,178,152,0.3)", borderRadius: 999, padding: "2px 10px", letterSpacing: "0.12em", marginLeft: 8 }}>SCHEDULER</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleBatchDemo} disabled={batchLoading}
            style={{ background: "#C0B298", color: "#1a1008", border: "none", borderRadius: 999, padding: "8px 20px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
            {batchLoading ? <span className="spin"><RefreshCw size={12} /></span> : "RUN DEMO BATCH"}
          </button>
          <button onClick={handleClear}
            style={{ background: "transparent", color: "rgba(249,245,239,0.5)", border: "1px solid rgba(249,245,239,0.15)", borderRadius: 999, padding: "8px 16px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
            RESET
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "48px 40px" }}>

        {/* ── HERO TITLE ── */}
        <div ref={headerRef} className={`${revealBase} ${headerIn ? revealIn : revealOut}`} style={{ marginBottom: 48 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: "clamp(3rem, 7vw, 7rem)", lineHeight: 0.85, letterSpacing: "-0.03em", textTransform: "uppercase", color: "#f9f5ef", marginBottom: 16 }}>
            BREACH<br/><span style={{ color: "#C0B298" }}>RESPONSE</span><br/>ENGINE.
          </h1>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 500, color: "rgba(249,245,239,0.55)", maxWidth: 520, lineHeight: 1.7, marginTop: 20 }}>
            Contract obligations routed to the right departments, severity scored, and conflict meetings auto-booked — in milliseconds.
          </p>
        </div>

        {/* ── STAT TILES ── */}
        <div ref={statsRef} className={`${revealBase} ${statsIn ? revealIn : revealOut}`}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 48 }}>
          <StatTile label="Total Tasks" value={tasks.length} icon={Zap} />
          <StatTile label="Critical" value={sevCounts.CRITICAL || 0} icon={AlertTriangle} accent="#ef4444" />
          <StatTile label="High" value={sevCounts.HIGH || 0} icon={TrendingDown} accent="#f97316" />
          <StatTile label="Meetings Booked" value={meetings.length} icon={Calendar} accent="#86efac" />
          <StatTile label="Departments Active" value={Object.keys(deptSummary).length} icon={Building2} />
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24, alignItems: "start" }}>

          {/* LEFT — FORM */}
          <div style={{ position: "sticky", top: 88 }}>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 11, color: "rgba(249,245,239,0.4)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
              ─ NEW BREACH INPUT
            </p>
            <BreachForm onSubmit={handleSingleBreach} loading={loading} />

            {/* Dept Summary */}
            {Object.keys(deptSummary).length > 0 && (
              <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(192,178,152,0.15)", borderRadius: 24, padding: 20 }}>
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 11, color: "#C0B298", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                  DEPARTMENT WORKLOAD
                </p>
                {Object.entries(deptSummary).map(([dept, info]) => (
                  <div key={dept} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, color: "#f9f5ef" }}>{dept}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {Object.entries(info).map(([s, count]) => count > 0 && (
                        <span key={s} style={{ fontSize: 10, fontWeight: 700, color: SEV[s]?.color || "#C0B298", background: SEV[s]?.bg || "rgba(192,178,152,0.1)", border: `1px solid ${SEV[s]?.border || "rgba(192,178,152,0.2)"}`, borderRadius: 999, padding: "1px 8px" }}>
                          {s[0]}{count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — TASKS + MEETINGS */}
          <div>
            {/* TAB SWITCHER */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 999, padding: 4, width: "fit-content" }}>
              {["tasks", "meetings"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ background: activeTab === tab ? "#C0B298" : "transparent", color: activeTab === tab ? "#1a1008" : "rgba(249,245,239,0.5)", border: "none", borderRadius: 999, padding: "8px 24px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}>
                  {tab === "tasks" ? `TASKS (${tasks.length})` : `MEETINGS (${meetings.length})`}
                </button>
              ))}
            </div>

            {/* SEVERITY FILTER */}
            {activeTab === "tasks" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {["ALL", ...Object.keys(SEV)].map(s => (
                  <button key={s} onClick={() => setFilterSev(s)}
                    style={{
                      background: filterSev === s ? (s === "ALL" ? "#C0B298" : SEV[s]?.bg) : "transparent",
                      border: `1px solid ${s === "ALL" ? "rgba(192,178,152,0.4)" : SEV[s]?.border || "rgba(192,178,152,0.3)"}`,
                      color: filterSev === s ? (s === "ALL" ? "#1a1008" : SEV[s]?.color) : "rgba(249,245,239,0.5)",
                      borderRadius: 999, padding: "6px 14px",
                      fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 10,
                      letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s"
                    }}>
                    {s} {s !== "ALL" && sevCounts[s] ? `(${sevCounts[s]})` : ""}
                  </button>
                ))}
              </div>
            )}

            {/* CONTENT */}
            {activeTab === "tasks" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredTasks.length === 0 ? (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(192,178,152,0.2)", borderRadius: 24, padding: "48px 24px", textAlign: "center" }}>
                    <Shield size={32} style={{ color: "rgba(192,178,152,0.3)", margin: "0 auto 12px" }} />
                    <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: "rgba(249,245,239,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      No tasks yet — process a breach or run the demo batch
                    </p>
                  </div>
                ) : (
                  filteredTasks.map((task, i) => <TaskCard key={task.task_id} task={task} idx={i} />)
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {meetings.length === 0 ? (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(192,178,152,0.2)", borderRadius: 24, padding: "48px 24px", textAlign: "center" }}>
                    <Calendar size={32} style={{ color: "rgba(192,178,152,0.3)", margin: "0 auto 12px" }} />
                    <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: "rgba(249,245,239,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      No meetings booked — conflict breaches auto-book meetings
                    </p>
                  </div>
                ) : (
                  meetings.map((m, i) => <MeetingCard key={i} meeting={m} />)
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "24px 40px", marginTop: 80, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={16} style={{ color: "#C0B298" }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(249,245,239,0.5)" }}>CONTRACTPULSE — BREACH SCHEDULER</span>
        </div>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(249,245,239,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>© 2026 CONTRACTPULSE</p>
      </footer>
    </div>
  );
}
