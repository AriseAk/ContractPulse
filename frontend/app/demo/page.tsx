"use client";
import { useState } from "react";
import Navbar from "../components/Navbar";
import Link from "next/link";
import { Upload, FileText, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";

const cls = {
  page: "min-h-screen bg-[#1a1008] text-[#f9f5ef] font-['Inter',sans-serif] selection:bg-[#C0B298] selection:text-[#1a1008]",
  clash: "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase",
  label: "text-[10px] tracking-[0.4em] text-[#C0B298] uppercase font-bold",
};

const SAMPLE_CONTRACT = {
  name: "Acme Corp — Term Loan Agreement",
  lender: "SBI Capital",
  amount: "₹5 Cr",
  date: "Jan 15, 2024",
  obligations: [
    { id: "C1", clause: "Section 8.2", type: "Financial Covenant", desc: "Debt/EBITDA ratio must remain below 3.5x at all times.", metric: "Debt/EBITDA", current: "2.9x", limit: "3.5x", risk: 58 },
    { id: "C2", clause: "Section 8.4", type: "Financial Covenant", desc: "Minimum cash balance of ₹50L must be maintained at month-end.", metric: "Cash Balance", current: "₹61L", limit: "₹50L", risk: 32 },
    { id: "C3", clause: "Section 9.1", type: "Financial Covenant", desc: "Interest Coverage Ratio (ICR) must exceed 1.5x quarterly.", metric: "ICR", current: "1.62x", limit: "1.5x", risk: 74 },
    { id: "C4", clause: "Section 11.3", type: "Reporting", desc: "Quarterly management accounts due within 45 days of quarter end.", metric: "Reporting", current: "On track", limit: "45 days", risk: 10 },
  ],
};

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

export default function DemoPage() {
  const [uploaded, setUploaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [revenue, setRevenue] = useState(0);
  const [cost, setCost] = useState(0);
  const [interest, setInterest] = useState(0);

  const handleSample = () => {
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setUploaded(true); setAnalyzed(true); }, 1800);
  };

  const adjustedRisk = (base: number) => {
    const adj = base + revenue * 0.4 + cost * 0.25 + interest * 0.3;
    return Math.min(99, Math.max(0, Math.round(adj)));
  };

  const overallRisk = analyzed
    ? Math.round(SAMPLE_CONTRACT.obligations.reduce((a, o) => a + adjustedRisk(o.risk), 0) / SAMPLE_CONTRACT.obligations.length)
    : 0;

  const timeRange = analyzed
    ? `${Math.max(7, 52 - Math.round((revenue + cost + interest) * 1.2))}–${Math.max(14, 68 - Math.round((revenue + cost + interest) * 0.8))} days`
    : "—";

  const drivers = analyzed ? [
    revenue > 0 && `Revenue decline of ${revenue}% increases Debt/EBITDA pressure`,
    cost > 0 && `Cost increase of ${cost}% compresses ICR margin`,
    interest > 0 && `Rate rise of ${interest}% directly reduces ICR`,
    "ICR at 1.62x vs 1.5x floor — only 8% margin",
  ].filter(Boolean) as string[] : [];

  return (
    <div className={cls.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');`}</style>
      <Navbar />

      <div className="pt-28 pb-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <p className={cls.label}>Interactive Demo</p>
            <h1 className={`${cls.clash} text-[clamp(2.5rem,6vw,5rem)] leading-[0.88] mt-3 mb-3`}>
              CONTRACT<br /><span className="text-[#C0B298]">PLAYGROUND</span>
            </h1>
            <p className="text-[#f9f5ef]/50 text-base">Upload a contract or use a sample. Adjust scenarios. See real-time breach risk.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
            {/* Left: Upload + Obligations */}
            <div className="space-y-6">
              {/* Upload Card */}
              {!analyzed ? (
                <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-10 flex flex-col items-center text-center gap-5">
                  <Upload size={36} className="text-[#C0B298]/60" />
                  <div>
                    <h3 className={`${cls.clash} text-xl mb-2`}>Upload a Contract</h3>
                    <p className="text-sm text-[#f9f5ef]/40">PDF, DOCX supported. AI extracts obligations instantly.</p>
                  </div>
                  <div className="flex gap-3 flex-wrap justify-center">
                    <button
                      onClick={handleSample}
                      disabled={analyzing}
                      className="bg-[#C0B298] text-[#1a1008] px-7 py-3 rounded-full text-sm font-black uppercase tracking-widest hover:bg-[#f9f5ef] transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {analyzing ? <><RefreshCw size={14} className="animate-spin" /> Processing…</> : "Use Sample Contract"}
                    </button>
                    <label className="border border-white/20 text-[#f9f5ef]/60 px-7 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:border-white/40 transition-colors cursor-pointer">
                      Upload PDF
                      <input type="file" accept=".pdf,.doc,.docx" className="hidden" />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#C0B298]/10 border border-[#C0B298]/20 flex items-center justify-center">
                      <FileText size={18} className="text-[#C0B298]" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{SAMPLE_CONTRACT.name}</p>
                      <p className="text-xs text-[#f9f5ef]/40">{SAMPLE_CONTRACT.lender} · {SAMPLE_CONTRACT.amount} · {SAMPLE_CONTRACT.date}</p>
                    </div>
                  </div>
                  <button onClick={() => { setAnalyzed(false); setUploaded(false); setRevenue(0); setCost(0); setInterest(0); }}
                    className="text-[10px] font-bold text-[#f9f5ef]/30 hover:text-[#C0B298] tracking-widest uppercase transition-colors">
                    Reset
                  </button>
                </div>
              )}

              {/* Obligations */}
              {analyzed && (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className={`${cls.clash} text-sm`}>Extracted Obligations ({SAMPLE_CONTRACT.obligations.length})</h3>
                    <span className="text-[10px] text-[#C0B298] tracking-widest uppercase font-bold">AI Extracted</span>
                  </div>
                  {SAMPLE_CONTRACT.obligations.map((o) => {
                    const adj = adjustedRisk(o.risk);
                    return (
                      <div key={o.id} className="px-6 py-5 border-b border-white/5 last:border-0">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <p className="text-[10px] text-[#f9f5ef]/40 mb-1 tracking-widest">{o.clause} · {o.type}</p>
                            <p className="text-sm text-[#f9f5ef]/80 leading-snug">{o.desc}</p>
                          </div>
                          <RiskBadge risk={adj} />
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-[#f9f5ef]/40">Current: <span className="text-[#f9f5ef]/80 font-medium">{o.current}</span></span>
                          <span className="text-xs text-[#f9f5ef]/40">Limit: <span className="text-[#f9f5ef]/80 font-medium">{o.limit}</span></span>
                        </div>
                        <div className="mt-3">
                          <RiskBar value={adj} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Sliders + Output */}
            <div className="space-y-6">
              {/* Scenario Sliders */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <h3 className={`${cls.clash} text-sm mb-6`}>Scenario Simulator</h3>
                <p className="text-xs text-[#f9f5ef]/40 mb-8 uppercase tracking-wide">Adjust parameters to see real-time impact on breach risk</p>
                {[
                  { label: "Revenue Decrease", val: revenue, set: setRevenue, color: "text-red-400" },
                  { label: "Cost Increase",    val: cost,    set: setCost,    color: "text-amber-400" },
                  { label: "Interest Rate Change", val: interest, set: setInterest, color: "text-orange-400" },
                ].map((s) => (
                  <div key={s.label} className="mb-8">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-semibold text-[#f9f5ef]/80">{s.label}</label>
                      <span className={`text-sm font-bold ${s.color}`}>+{s.val}%</span>
                    </div>
                    <input
                      type="range" min={0} max={30} value={s.val}
                      onChange={(e) => s.set(Number(e.target.value))}
                      className="w-full accent-[#C0B298] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#f9f5ef]/25 mt-1">
                      <span>0%</span><span>15%</span><span>30%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Output Panel */}
              <div className={`border rounded-2xl p-8 transition-all duration-500 ${analyzed ? "bg-[#C0B298]/8 border-[#C0B298]/20" : "bg-white/5 border-white/10 opacity-40 pointer-events-none"}`}>
                <h3 className={`${cls.clash} text-sm mb-6`}>Risk Output</h3>

                {/* Overall Score */}
                <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/5">
                  <div>
                    <p className="text-[10px] tracking-widest uppercase font-bold text-[#f9f5ef]/50 mb-1">Overall Breach Risk</p>
                    <p className={`font-['Space_Grotesk',sans-serif] font-bold text-6xl leading-none ${overallRisk >= 70 ? "text-red-400" : overallRisk >= 40 ? "text-amber-400" : "text-emerald-400"}`}>
                      {analyzed ? overallRisk : "—"}<span className="text-2xl">%</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] tracking-widest uppercase font-bold text-[#f9f5ef]/50 mb-1">Time-to-Breach</p>
                    <p className={`font-['Space_Grotesk',sans-serif] font-bold text-2xl text-[#C0B298]`}>{timeRange}</p>
                  </div>
                </div>

                {/* Key Drivers */}
                {drivers.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] tracking-widest uppercase font-bold text-[#f9f5ef]/50 mb-3 flex items-center gap-2">
                      <AlertTriangle size={12} /> Key Risk Drivers
                    </p>
                    <div className="space-y-2">
                      {drivers.map((d, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-[#f9f5ef]/70">
                          <ArrowRight size={12} className="text-amber-400 mt-0.5 shrink-0" /> {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {analyzed && (
                  <div>
                    <p className="text-[10px] tracking-widest uppercase font-bold text-[#C0B298] mb-3">Recommended Actions</p>
                    <div className="space-y-2">
                      {[
                        "Improve ICR by reducing short-term interest-bearing debt",
                        "Prepare lender communication if ICR drops below 1.55x",
                        "Lock in a cost-reduction plan to offset revenue sensitivity",
                      ].map((r) => (
                        <div key={r} className="flex items-start gap-2 text-sm text-[#f9f5ef]/60">
                          <span className="text-[#C0B298] mt-0.5">✦</span> {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!analyzed && (
                  <p className="text-center text-sm text-[#f9f5ef]/30 py-8">Upload or use a sample contract to see output.</p>
                )}
              </div>

              {analyzed && (
                <Link href="/report" className="flex items-center justify-between w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 hover:border-[#C0B298]/30 transition-colors group">
                  <span className={`${cls.clash} text-sm`}>View full covenant risk report</span>
                  <ArrowRight size={18} className="text-[#C0B298] group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
