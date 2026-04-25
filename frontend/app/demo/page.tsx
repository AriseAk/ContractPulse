"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import Navbar from "../components/Navbar";
import Link from "next/link";
import { Upload, FileText, AlertTriangle, ArrowRight, RefreshCw, Eye, List, ChevronDown } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

const cls = {
  page: "min-h-screen bg-[#1a1008] text-[#f9f5ef] font-['Inter',sans-serif] selection:bg-[#C0B298] selection:text-[#1a1008]",
  clash: "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase",
  label: "text-[10px] tracking-[0.4em] text-[#C0B298] uppercase font-bold",
};

interface Obligation {
  id: string;
  clause: string;
  type: string;
  desc: string;
  confidence: number;
  risk: number;
  source_text: string;
}

/* ─── Risk Components ─── */
function RiskBadge({ risk }: { risk: number }) {
  const color = risk >= 70 ? "text-red-400 bg-red-400/10 border-red-400/30"
              : risk >= 40 ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
              : "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
  const label = risk >= 70 ? "High Risk" : risk >= 40 ? "Warning" : "Safe";
  return <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border ${color}`}>{label} {risk}%</span>;
}

function RiskBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-red-400" : value >= 40 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

/* ─── Highlight colors per obligation ─── */
const HIGHLIGHT_COLORS = [
  { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#fca5a5" },   // red
  { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", text: "#fcd34d" },  // amber
  { bg: "rgba(16, 185, 129, 0.15)", border: "#10b981", text: "#6ee7b7" },  // emerald
  { bg: "rgba(99, 102, 241, 0.15)", border: "#6366f1", text: "#a5b4fc" },  // indigo
  { bg: "rgba(236, 72, 153, 0.15)", border: "#ec4899", text: "#f9a8d4" },  // pink
  { bg: "rgba(14, 165, 233, 0.15)", border: "#0ea5e9", text: "#7dd3fc" },  // sky
  { bg: "rgba(168, 85, 247, 0.15)", border: "#a855f7", text: "#c4b5fd" },  // purple
  { bg: "rgba(251, 146, 60, 0.15)", border: "#fb923c", text: "#fdba74" },  // orange
];

/* ─── Contract Document Viewer with Highlights ─── */
function ContractViewer({
  contractText,
  obligations,
  activeId,
  onHighlightClick,
}: {
  contractText: string;
  obligations: Obligation[];
  activeId: string | null;
  onHighlightClick: (id: string) => void;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);

  // Build highlighted HTML from the contract text
  const highlightedHtml = useMemo(() => {
    if (!contractText) return "";
    if (obligations.length === 0) return escapeHtml(contractText);

    // Collect all spans to highlight with their positions
    interface Span { start: number; end: number; oblIdx: number; id: string }
    const spans: Span[] = [];

    obligations.forEach((o, idx) => {
      if (!o.source_text || o.source_text.length < 3) return;
      const needle = o.source_text;
      let searchFrom = 0;
      let found = false;
      // Try exact match first
      while (searchFrom < contractText.length) {
        const pos = contractText.indexOf(needle, searchFrom);
        if (pos === -1) break;
        spans.push({ start: pos, end: pos + needle.length, oblIdx: idx, id: o.id });
        searchFrom = pos + needle.length;
        found = true;
      }
      // Fallback: case-insensitive search
      if (!found) {
        const lowerContract = contractText.toLowerCase();
        const lowerNeedle = needle.toLowerCase();
        searchFrom = 0;
        while (searchFrom < lowerContract.length) {
          const pos = lowerContract.indexOf(lowerNeedle, searchFrom);
          if (pos === -1) break;
          spans.push({ start: pos, end: pos + needle.length, oblIdx: idx, id: o.id });
          searchFrom = pos + needle.length;
        }
      }
    });

    if (spans.length === 0) return escapeHtml(contractText);

    // Sort by start position, longest first for overlaps
    spans.sort((a, b) => a.start - b.start || b.end - a.end);

    // Remove overlapping spans (keep the first/longest)
    const filtered: Span[] = [];
    let lastEnd = -1;
    for (const s of spans) {
      if (s.start >= lastEnd) {
        filtered.push(s);
        lastEnd = s.end;
      }
    }

    // Build HTML
    let html = "";
    let cursor = 0;
    for (const span of filtered) {
      html += escapeHtml(contractText.slice(cursor, span.start));
      const color = HIGHLIGHT_COLORS[span.oblIdx % HIGHLIGHT_COLORS.length];
      const isActive = activeId === span.id;
      html += `<mark 
        data-id="${span.id}" 
        style="
          background: ${isActive ? color.border + '33' : color.bg};
          border-bottom: 2px solid ${color.border};
          border-radius: 3px;
          padding: 1px 3px;
          cursor: pointer;
          transition: all 0.2s;
          color: #111827;
          ${isActive ? `box-shadow: 0 0 0 2px ${color.border}40; outline: 1px solid ${color.border};` : ''}
        "
        class="highlight-span"
      >${escapeHtml(contractText.slice(span.start, span.end))}<sup style="
          font-size: 9px;
          background: ${color.border};
          color: #ffffff;
          border-radius: 999px;
          padding: 0 4px;
          margin-left: 3px;
          font-weight: 800;
        ">${span.id}</sup></mark>`;
      cursor = span.end;
    }
    html += escapeHtml(contractText.slice(cursor));
    return html;
  }, [contractText, obligations, activeId]);

  // Scroll to active highlight
  useEffect(() => {
    if (!activeId || !viewerRef.current) return;
    const el = viewerRef.current.querySelector(`mark[data-id="${activeId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeId]);

  // Handle click on highlights
  const handleClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest("mark[data-id]");
    if (target) {
      const id = target.getAttribute("data-id");
      if (id) onHighlightClick(id);
    }
  };

  // Show message if no text available
  if (!contractText) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col h-[600px] lg:h-[calc(100vh-160px)] lg:min-h-[600px] items-center justify-center">
        <FileText size={36} className="text-gray-300 mb-4" />
        <p className="text-gray-500 text-sm text-center px-8">
          Contract text will appear here after analysis.<br />
          <span className="text-gray-400 text-xs">AI-recognized clauses will be highlighted in color.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden flex flex-col h-[600px] lg:h-[calc(100vh-160px)] lg:min-h-[600px]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
          <span className="text-[10px] text-gray-500 ml-2 tracking-widest uppercase font-semibold">Contract Document</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye size={12} className="text-gray-400" />
          <span className="text-[10px] text-gray-600 font-bold tracking-widest">
            {obligations.filter(o => o.source_text).length} HIGHLIGHTS
          </span>
        </div>
      </div>
      
      {/* Highlight Legend */}
      {obligations.length > 0 && (
        <div className="px-5 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 shrink-0 bg-white">
          {obligations.filter(o => o.source_text).map((o, idx) => {
            const color = HIGHLIGHT_COLORS[idx % HIGHLIGHT_COLORS.length];
            return (
              <button
                key={o.id}
                onClick={() => onHighlightClick(o.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase transition-all ${
                  activeId === o.id ? 'ring-1 ring-gray-300 scale-105' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ background: color.bg, color: '#111827', borderBottom: `2px solid ${color.border}` }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 99, background: color.border, display: 'inline-block' }} />
                {o.id}
              </button>
            );
          })}
        </div>
      )}

      {/* Document Body */}
      <div
        ref={viewerRef}
        className="flex-1 overflow-y-auto px-6 py-6 text-sm text-gray-800 leading-[1.85] whitespace-pre-wrap font-mono selection:bg-blue-100 selection:text-blue-900"
        style={{ scrollBehavior: 'smooth' }}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    </div>
  );
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── Main Page ─── */
export default function DemoPage() {
  const [analyzing, setAnalyzing]   = useState(false);
  const [analyzed, setAnalyzed]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [contractName, setContractName] = useState("");
  const [contractText, setContractText] = useState("");
  const [activeObligationId, setActiveObligationId] = useState<string | null>(null);

  // Panel toggle for mobile
  const [showPanel, setShowPanel] = useState<"document" | "obligations">("document");

  // Scenario sliders state
  const [revenue, setRevenue]   = useState(0);
  const [cost, setCost]         = useState(0);
  const [interest, setInterest] = useState(0);

  const sample_text = `TERM LOAN AGREEMENT — SBI CAPITAL MARKETS

Section 8.2 — Financial Covenant: Debt/EBITDA Ratio
The Borrower shall maintain a Debt to EBITDA ratio of no greater than 3.5x as measured at the end of each fiscal quarter.

Section 8.4 — Financial Covenant: Minimum Cash Balance
The Borrower shall maintain a minimum cash balance of INR 50 Lakhs in its primary operating account at the end of each calendar month.

Section 9.1 — Financial Covenant: Interest Coverage Ratio
The Borrower shall ensure that the Interest Coverage Ratio (ICR) exceeds 1.5x as measured on a trailing twelve-month basis at each quarter end.

Section 11.3 — Reporting Obligation
The Borrower shall deliver to the Lender quarterly management accounts within 45 days of the end of each fiscal quarter, certified by the Chief Financial Officer.

Section 12.1 — Restriction Covenant: Dividends
The Borrower shall not declare or pay any dividends or make any distributions to its shareholders without the prior written consent of the Lender while any amounts remain outstanding.`;

  const runAnalysis = async (text: string, name: string) => {
    setAnalyzing(true);
    setError(null);
    setContractName(name);
    try {
      const res = await fetch(`${BACKEND}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setObligations(data.obligations);
      setContractText(data.contract_text || text);
      setAnalyzed(true);
    } catch (err: any) {
      setError(err.message || "An error occurred. Is the Flask backend running?");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSample = () => runAnalysis(sample_text, "Acme Corp — Term Loan Agreement (Sample)");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setContractName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BACKEND}/api/analyze`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setObligations(data.obligations);
      setContractText(data.contract_text || "");
      setAnalyzed(true);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setAnalyzed(false);
    setObligations([]);
    setContractText("");
    setRevenue(0);
    setCost(0);
    setInterest(0);
    setError(null);
    setActiveObligationId(null);
  };

  const adjustedRisk = (base: number) => {
    const adj = base + revenue * 0.4 + cost * 0.25 + interest * 0.3;
    return Math.min(99, Math.max(0, Math.round(adj)));
  };

  const overallRisk = analyzed
    ? Math.round(obligations.reduce((a, o) => a + adjustedRisk(o.risk), 0) / (obligations.length || 1))
    : 0;

  const timeRange = analyzed
    ? `${Math.max(7, 52 - Math.round((revenue + cost + interest) * 1.2))}–${Math.max(14, 68 - Math.round((revenue + cost + interest) * 0.8))} days`
    : "—";

  const drivers = analyzed ? [
    revenue > 0 && `Revenue decline of ${revenue}% increases Debt/EBITDA pressure`,
    cost > 0 && `Cost increase of ${cost}% compresses ICR margin`,
    interest > 0 && `Rate rise of ${interest}% directly reduces ICR`,
    "ICR is the highest-risk covenant — minimal buffer detected",
  ].filter(Boolean) as string[] : [];

  // Persist to localStorage for the Report page
  useEffect(() => {
    if (analyzed && obligations.length > 0) {
      localStorage.setItem("cPulse_report", JSON.stringify({
        contractName,
        obligations: obligations.map(o => ({ ...o, adjustedRisk: adjustedRisk(o.risk) })),
        overallRisk,
        timeRange,
      }));
    }
  }, [analyzed, obligations, revenue, cost, interest, contractName, overallRisk, timeRange]);

  return (
    <div className={cls.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');
        .highlight-span:hover { filter: brightness(0.95); }
      `}</style>
      <Navbar />

      <div className="pt-28 pb-16 px-6 md:px-12">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="mb-10">
            <p className={cls.label}>Interactive Demo</p>
            <h1 className={`${cls.clash} text-[clamp(2.5rem,6vw,5rem)] leading-[0.88] mt-3 mb-3`}>
              CONTRACT<br /><span className="text-[#C0B298]">PLAYGROUND</span>
            </h1>
            <p className="text-[#f9f5ef]/50 text-base max-w-xl">Upload a contract or use a sample. AI highlights key clauses and extracts obligations in real-time.</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-6 py-4 flex items-center gap-3 text-sm text-red-400">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* Upload Card (shown before analysis) */}
          {!analyzed && (
            <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-10 flex flex-col items-center text-center gap-5 max-w-2xl mx-auto mb-10">
              <Upload size={36} className="text-[#C0B298]/60" />
              <div>
                <h3 className={`${cls.clash} text-xl mb-2`}>Upload a Contract</h3>
                <p className="text-sm text-[#f9f5ef]/40">PDF, DOCX supported. AI extracts obligations and highlights key clauses.</p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center mt-2">
                <button
                  onClick={handleSample}
                  disabled={analyzing}
                  className="bg-[#C0B298] text-[#1a1008] px-7 py-3 rounded-full text-sm font-black uppercase tracking-widest hover:bg-[#f9f5ef] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {analyzing ? <><RefreshCw size={14} className="animate-spin" /> Analyzing…</> : "Use Sample Contract"}
                </button>
                <label className="border border-white/20 text-[#f9f5ef]/60 px-7 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:border-white/40 transition-colors cursor-pointer flex items-center gap-2">
                  Upload PDF
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFile} disabled={analyzing} />
                </label>
              </div>
            </div>
          )}

          {/* Main Content (shown after analysis) */}
          {analyzed && (
            <>
              {/* Contract info bar */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#C0B298]/10 border border-[#C0B298]/20 flex items-center justify-center">
                    <FileText size={18} className="text-[#C0B298]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{contractName}</p>
                    <p className="text-xs text-[#f9f5ef]/40 mt-0.5">{obligations.length} obligations extracted · {obligations.filter(o => o.source_text).length} clauses highlighted</p>
                  </div>
                </div>
                <button onClick={reset} className="text-[10px] font-bold text-[#f9f5ef]/30 hover:text-[#C0B298] tracking-widest uppercase transition-colors px-2 py-1">
                  Reset
                </button>
              </div>

              {/* Mobile Panel Switcher for Row 1 */}
              <div className="lg:hidden flex gap-3 mb-6">
                <button
                  onClick={() => setShowPanel("document")}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                    showPanel === "document" ? "bg-[#C0B298]/20 text-[#C0B298] border border-[#C0B298]/30" : "bg-white/5 text-[#f9f5ef]/40 border border-white/10"
                  }`}
                >
                  <Eye size={14} /> Document
                </button>
                <button
                  onClick={() => setShowPanel("obligations")}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                    showPanel === "obligations" ? "bg-[#C0B298]/20 text-[#C0B298] border border-[#C0B298]/30" : "bg-white/5 text-[#f9f5ef]/40 border border-white/10"
                  }`}
                >
                  <List size={14} /> Obligations
                </button>
              </div>

              {/* ROW 1: Contract Document (Left) & Extracted Obligations (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-10 items-start mb-6 lg:mb-10">
                {/* LEFT: Contract Document Viewer */}
                <div className={`${showPanel === "document" ? "block" : "hidden"} lg:block lg:sticky lg:top-32`}>
                  <ContractViewer
                    contractText={contractText}
                    obligations={obligations}
                    activeId={activeObligationId}
                    onHighlightClick={(id) => setActiveObligationId(prev => prev === id ? null : id)}
                  />
                </div>

                {/* RIGHT: Obligations List */}
                <div className={`${showPanel === "obligations" ? "block" : "hidden"} lg:block`}>
                  <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[600px] lg:h-[calc(100vh-160px)] lg:min-h-[600px]">
                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
                      <h3 className={`${cls.clash} text-sm`}>Extracted Obligations ({obligations.length})</h3>
                      <span className="text-[10px] text-[#C0B298] tracking-widest uppercase font-bold">AI Analyzed</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {obligations.map((o, idx) => {
                        const adj = adjustedRisk(o.risk);
                        const color = HIGHLIGHT_COLORS[idx % HIGHLIGHT_COLORS.length];
                        const isActive = activeObligationId === o.id;
                        return (
                          <div
                            key={o.id}
                            className={`px-6 py-5 border-b border-white/5 last:border-0 cursor-pointer transition-all ${
                              isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.03]'
                            }`}
                            onClick={() => setActiveObligationId(prev => prev === o.id ? null : o.id)}
                          >
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex items-start gap-3">
                                <span
                                  className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                                  style={{ background: color.border, color: '#1a1008' }}
                                >
                                  {o.id.replace('C', '')}
                                </span>
                                <div>
                                  <p className="text-[10px] text-[#f9f5ef]/40 mb-1.5 tracking-widest">{o.clause} · {o.type}</p>
                                  <p className="text-sm text-[#f9f5ef]/80 leading-snug">{o.desc}</p>
                                  {o.source_text && (
                                    <p className="text-xs text-[#f9f5ef]/30 mt-3 italic border-l-2 pl-3" style={{ borderColor: color.border }}>
                                      &ldquo;{o.source_text.length > 120 ? o.source_text.substring(0, 120) + "..." : o.source_text}&rdquo;
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="shrink-0">
                                <RiskBadge risk={adj} />
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mb-2.5 ml-8">
                              <span className="text-[11px] text-[#f9f5ef]/40">Confidence: <span className="text-[#C0B298] font-medium">{o.confidence}%</span></span>
                            </div>
                            <div className="mt-2 ml-8">
                              <RiskBar value={adj} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ROW 2: Scenario Simulator (Left) & Risk Output (Right) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 mb-8">
                {/* Scenario Sliders */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 lg:p-8 flex flex-col">
                  <h3 className={`${cls.clash} text-lg mb-2`}>Scenario Simulator</h3>
                  <p className="text-[11px] text-[#f9f5ef]/40 mb-8 uppercase tracking-wide leading-relaxed">Adjust parameters to see real-time impact on breach risk</p>
                  <div className="flex-1 flex flex-col justify-center gap-6">
                    {[
                      { label: "Revenue Decrease", val: revenue, set: setRevenue, color: "text-red-400" },
                      { label: "Cost Increase",    val: cost,    set: setCost,    color: "text-amber-400" },
                      { label: "Interest Rate Change", val: interest, set: setInterest, color: "text-orange-400" },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className="flex justify-between items-center mb-3">
                          <label className="text-sm font-semibold text-[#f9f5ef]/80">{s.label}</label>
                          <span className={`text-sm font-bold ${s.color}`}>+{s.val}%</span>
                        </div>
                        <input
                          type="range" min={0} max={30} value={s.val}
                          onChange={(e) => s.set(Number(e.target.value))}
                          className="w-full accent-[#C0B298] cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-[#f9f5ef]/25 mt-2">
                          <span>0%</span><span>15%</span><span>30%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk Output */}
                <div className="bg-[#C0B298]/10 border border-[#C0B298]/20 rounded-2xl p-6 lg:p-8 flex flex-col">
                  <h3 className={`${cls.clash} text-lg mb-6 text-[#C0B298]`}>Risk Output</h3>

                  <div className="flex flex-col gap-6 mb-6 pb-6 border-b border-white/10">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] tracking-widest uppercase font-bold text-[#f9f5ef]/50 mb-2">Overall Breach</p>
                        <p className={`font-['Space_Grotesk',sans-serif] font-bold text-5xl leading-none ${overallRisk >= 70 ? "text-red-400" : overallRisk >= 40 ? "text-amber-400" : "text-emerald-400"}`}>
                          {overallRisk}<span className="text-2xl opacity-50 ml-1">%</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] tracking-widest uppercase font-bold text-[#f9f5ef]/50 mb-2">Timeline</p>
                        <p className={`font-['Space_Grotesk',sans-serif] font-bold text-xl text-[#f9f5ef]`}>{timeRange}</p>
                      </div>
                    </div>
                  </div>

                  {drivers.length > 0 && (
                    <div className="flex-1 flex flex-col justify-end">
                      <p className="text-[10px] tracking-widest uppercase font-bold text-[#f9f5ef]/50 mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-400" /> Key Risk Drivers
                      </p>
                      <div className="space-y-2">
                        {drivers.map((d, i) => (
                          <div key={i} className="flex items-start gap-3 text-xs text-[#f9f5ef]/80 bg-black/20 p-3 rounded-lg border border-white/5">
                            <ArrowRight size={12} className="text-amber-400 mt-0.5 shrink-0" /> 
                            <span className="leading-snug">{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Report Link */}
              <Link href="/report" className="flex items-center justify-between w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-6 hover:border-[#C0B298]/40 hover:bg-white/10 transition-all group">
                <span className={`${cls.clash} text-sm`}>View full covenant risk report</span>
                <div className="w-8 h-8 rounded-full bg-[#C0B298]/20 flex items-center justify-center group-hover:bg-[#C0B298] group-hover:text-black transition-colors">
                  <ArrowRight size={16} className="text-[#C0B298] group-hover:text-[#1a1008] transition-colors" />
                </div>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}