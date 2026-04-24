"use client";
import Navbar from "../components/Navbar";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Clock, ArrowRight, FileText, TrendingDown, Bell } from "lucide-react";

const cls = {
  page: "min-h-screen bg-[#0f0a05] text-[#f9f5ef] font-['Inter',sans-serif] selection:bg-[#C0B298] selection:text-[#1a1008]",
  clash: "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase",
  label: "text-[10px] tracking-[0.4em] text-[#C0B298] uppercase font-bold",
};

const contracts = [
  { id: "CT-001", name: "SBI Term Loan",          counterparty: "State Bank of India",    value: "₹5 Cr",   status: "warning",  risk: 74, ttb: "36–52 days",  covenants: 4 },
  { id: "CT-002", name: "HDFC Working Capital",   counterparty: "HDFC Bank",             value: "₹1.5 Cr", status: "safe",     risk: 28, ttb: "120+ days",   covenants: 3 },
  { id: "CT-003", name: "Vendor SLA — TechCorp",  counterparty: "TechCorp Pvt Ltd",      value: "—",       status: "safe",     risk: 15, ttb: "180+ days",   covenants: 2 },
  { id: "CT-004", name: "Infra Bank Facility",    counterparty: "Infrastructure Fin. Co",value: "₹12 Cr",  status: "high",     risk: 88, ttb: "11–18 days",  covenants: 6 },
  { id: "CT-005", name: "Partnership Deed — ALT", counterparty: "ALT Capital",           value: "₹3 Cr",   status: "warning",  risk: 51, ttb: "58–74 days",  covenants: 3 },
  { id: "CT-006", name: "Promoter Pledge Agreement", counterparty: "Private Lender",     value: "₹2 Cr",   status: "safe",     risk: 22, ttb: "150+ days",   covenants: 2 },
];

const topRisks = [
  { cov: "Infra Bank — ICR Covenant",   risk: 88, margin: "0.04x above floor",  action: "Raise equity or reduce debt immediately" },
  { cov: "SBI — Debt/EBITDA ratio",     risk: 74, margin: "0.6x above limit",   action: "Engage lender for covenant waiver discussion" },
  { cov: "ALT Capital — Cash covenant", risk: 51, margin: "₹11L above minimum", action: "Monitor monthly; accelerate receivables" },
];

const alerts = [
  { type: "high",    msg: "ICR for Infra Bank Facility hits breach threshold in estimated 11–18 days." },
  { type: "warning", msg: "SBI Debt/EBITDA ratio rising — 47 days to projected breach at current rate." },
  { type: "info",    msg: "Quarterly management accounts due for SBI loan in 14 days." },
  { type: "safe",    msg: "HDFC Working Capital covenants — all within safe margins." },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    high:    "bg-red-400/10 text-red-400 border-red-400/30",
    warning: "bg-amber-400/10 text-amber-400 border-amber-400/30",
    safe:    "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  };
  const labels: Record<string, string> = { high: "High Risk", warning: "Warning", safe: "Safe" };
  return <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border ${map[status]}`}>{labels[status]}</span>;
}

function RiskBar({ value, status }: { value: number; status: string }) {
  const color = status === "high" ? "bg-red-400" : status === "warning" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="w-20 bg-white/5 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function AlertIcon({ type }: { type: string }) {
  if (type === "high") return <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />;
  if (type === "warning") return <Clock size={14} className="text-amber-400 shrink-0 mt-0.5" />;
  if (type === "safe") return <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />;
  return <Bell size={14} className="text-[#C0B298] shrink-0 mt-0.5" />;
}

export default function DashboardPage() {
  const highRiskCount = contracts.filter(c => c.status === "high").length;
  const warningCount  = contracts.filter(c => c.status === "warning").length;

  return (
    <div className={cls.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');`}</style>
      <Navbar />

      <div className="pt-24 pb-16 px-6 md:px-10">
        <div className="max-w-[1400px] mx-auto">

          {/* Top bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <p className="text-[10px] text-[#f9f5ef]/30 tracking-widest uppercase font-bold mb-1">ContractPulse · Dashboard</p>
              <h1 className={`${cls.clash} text-2xl`}>CONTRACT PORTFOLIO</h1>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link href="/demo" className="border border-white/10 text-[#f9f5ef]/60 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:border-[#C0B298] hover:text-[#C0B298] transition-colors">
                + New Contract
              </Link>
              <Link href="/report" className="bg-[#C0B298] text-[#1a1008] px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#f9f5ef] transition-colors">
                Generate Report
              </Link>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Contracts",  val: contracts.length.toString(), sub: "Active" },
              { label: "High Risk",         val: highRiskCount.toString(),    sub: "Immediate attention", accent: true },
              { label: "Warning",           val: warningCount.toString(),     sub: "Monitor closely" },
              { label: "Avg Risk Score",    val: `${Math.round(contracts.reduce((a, c) => a + c.risk, 0) / contracts.length)}%`, sub: "Portfolio average" },
            ].map((k) => (
              <div key={k.label} className={`rounded-2xl p-6 border ${k.accent ? "bg-red-400/5 border-red-400/20" : "bg-white/5 border-white/5"}`}>
                <p className="text-[10px] tracking-widest uppercase font-bold text-[#f9f5ef]/40 mb-2">{k.label}</p>
                <p className={`font-['Space_Grotesk',sans-serif] font-bold text-3xl mb-1 ${k.accent ? "text-red-400" : "text-[#f9f5ef]"}`}>{k.val}</p>
                <p className="text-xs text-[#f9f5ef]/30">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">
            {/* Left: Contracts table */}
            <div className="space-y-4">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_80px_80px_100px_100px] gap-4 px-5 py-3 text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/30 border-b border-white/5">
                <span>Contract</span><span>Counterparty</span><span>Covenants</span><span>Risk</span><span>TT-Breach</span><span>Status</span>
              </div>

              {contracts.map((c) => (
                <Link key={c.id} href="/demo" className="block bg-white/5 border border-white/5 rounded-2xl hover:border-[#C0B298]/20 hover:bg-white/8 transition-all">
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_80px_80px_100px_100px] gap-4 items-center px-5 py-5">
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-[#C0B298]" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-[10px] text-[#f9f5ef]/30 mt-0.5">{c.id} · {c.value}</p>
                      </div>
                    </div>
                    <p className="text-sm text-[#f9f5ef]/60 hidden md:block">{c.counterparty}</p>
                    <p className="text-sm font-medium text-center hidden md:block">{c.covenants}</p>
                    <div className="flex flex-col items-center gap-1.5 hidden md:flex">
                      <span className="text-sm font-bold">{c.risk}%</span>
                      <RiskBar value={c.risk} status={c.status} />
                    </div>
                    <p className={`text-xs font-semibold hidden md:block text-center ${c.status === "high" ? "text-red-400" : c.status === "warning" ? "text-amber-400" : "text-emerald-400"}`}>{c.ttb}</p>
                    <div className="flex justify-center">
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Right: Alerts + Top Risks */}
            <div className="space-y-6">
              {/* Alerts */}
              <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                  <Bell size={14} className="text-[#C0B298]" />
                  <h3 className={`${cls.clash} text-xs`}>Live Alerts</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {alerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 px-5 py-4">
                      <AlertIcon type={a.type} />
                      <p className="text-xs text-[#f9f5ef]/60 leading-relaxed">{a.msg}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Risks */}
              <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                  <TrendingDown size={14} className="text-red-400" />
                  <h3 className={`${cls.clash} text-xs`}>Top Risks This Week</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {topRisks.map((r, i) => (
                    <div key={i} className="px-5 py-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-semibold leading-snug">{r.cov}</p>
                        <span className={`text-sm font-bold shrink-0 ${r.risk >= 70 ? "text-red-400" : "text-amber-400"}`}>{r.risk}%</span>
                      </div>
                      <p className="text-xs text-[#f9f5ef]/40 mb-3">{r.margin}</p>
                      <div className="flex items-start gap-2">
                        <ArrowRight size={12} className="text-[#C0B298] mt-0.5 shrink-0" />
                        <p className="text-xs text-[#C0B298]">{r.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 border-t border-white/5">
                  <Link href="/report" className="text-[10px] font-bold tracking-widest uppercase text-[#C0B298] hover:text-[#f9f5ef] transition-colors flex items-center gap-2">
                    View Full Report <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
