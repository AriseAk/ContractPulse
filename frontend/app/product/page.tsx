"use client";
import Navbar from "../components/Navbar";
import Link from "next/link";
import { ArrowRight, FileText, AlertTriangle, TrendingDown, GitBranch, Play, BarChart2 } from "lucide-react";

const cls = {
  page: "min-h-screen bg-[#1a1008] text-[#f9f5ef] font-['Inter',sans-serif] selection:bg-[#C0B298] selection:text-[#1a1008]",
  clash: "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase",
  label: "text-[10px] tracking-[0.4em] text-[#C0B298] uppercase font-bold",
  card: "bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/8 transition-colors",
  pill: "inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[#C0B298]/30 text-[#C0B298] text-[10px] font-bold tracking-widest uppercase",
};

const modules = [
  {
    icon: <FileText size={22} className="text-[#C0B298]" />,
    n: "01",
    title: "Obligation Extraction",
    tagline: "Know exactly what you owe.",
    body: "AI reads every clause in your loan agreements, vendor SLAs, and partnership deeds. Each obligation is classified, confidence-scored, and surfaced for review — no manual parsing.",
    data: ["Payment schedule detection", "Covenant identification", "Confidence scoring", "Human-in-loop flagging"],
  },
  {
    icon: <AlertTriangle size={22} className="text-[#C0B298]" />,
    n: "02",
    title: "Risk Prediction",
    tagline: "Catch breaches before they happen.",
    body: "Our model assigns a 0–100 breach risk score to every covenant based on your current financials. Scores update daily as your data changes.",
    data: ["0–100 risk score", "Daily recalculation", "Trend detection", "Multi-covenant view"],
  },
  {
    icon: <GitBranch size={22} className="text-[#C0B298]" />,
    n: "03",
    title: "Explainability — WHY",
    tagline: "Understand the reason, not just the score.",
    body: "Every risk score comes with a plain-language explanation of why it's elevated — which metric is drifting, which clause it violates, and what the margin looks like.",
    data: ["Root-cause analysis", "Clause-to-metric mapping", "Margin tracking", "Plain English output"],
  },
  {
    icon: <TrendingDown size={22} className="text-[#C0B298]" />,
    n: "04",
    title: "Time-to-Breach — WHEN",
    tagline: "Not just risk. A timeline.",
    body: "The system projects breach timelines using trend extrapolation. You see not just IF you'll breach a covenant, but WHEN — down to a specific week.",
    data: ["36–52 day projections", "Trend extrapolation", "Calendar view", "Alert triggers"],
  },
  {
    icon: <Play size={22} className="text-[#C0B298]" />,
    n: "05",
    title: "Scenario Simulator — WHAT IF",
    tagline: "Test stress before stress tests you.",
    body: "Run scenarios: revenue drops 20%, interest rate jumps 2%, you delay a supplier payment. See the ripple across every covenant instantly.",
    data: ["Revenue / cost sliders", "Instant recalculation", "Multi-contract impact", "Export scenarios"],
  },
  {
    icon: <BarChart2 size={22} className="text-[#C0B298]" />,
    n: "06",
    title: "Portfolio Risk View — WHO",
    tagline: "Total exposure, at a glance.",
    body: "For NBFCs and lenders: see breach risk across your entire borrower portfolio. Rank by risk, filter by sector, monitor in real time.",
    data: ["Borrower risk ranking", "Sector filters", "Aggregate exposure", "Lender dashboard"],
  },
];

export default function ProductPage() {
  return (
    <div className={cls.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');`}</style>
      <Navbar />

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 md:px-12 border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <p className={cls.label}>The Platform</p>
          <h1 className={`${cls.clash} text-[clamp(3rem,8vw,8rem)] leading-[0.88] mt-4 mb-6`}>
            COVENANT<br />INTELLIGENCE<br /><span className="text-[#C0B298]">SYSTEM</span>
          </h1>
          <p className="text-[#f9f5ef]/60 text-lg max-w-xl leading-relaxed mb-10">
            Six modules that transform a static PDF contract into a live, predictive monitoring engine.
          </p>
          <div className="flex gap-4 flex-wrap">
            <Link href="/demo" className="bg-[#C0B298] text-[#1a1008] px-8 py-3.5 rounded-full text-sm font-black uppercase tracking-widest hover:bg-[#f9f5ef] transition-colors">
              Try the Demo →
            </Link>
            <Link href="/dashboard" className="border border-white/20 text-[#f9f5ef] px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-widest hover:border-[#C0B298] hover:text-[#C0B298] transition-colors">
              View Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Modules */}
      {modules.map((m, i) => (
        <section key={i} className={`py-24 px-6 md:px-12 border-b border-white/5 ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className={i % 2 === 1 ? "md:order-2" : ""}>
              <p className={cls.label}>{m.n} / 06</p>
              <div className="flex items-center gap-3 my-4">
                {m.icon}
                <h2 className={`${cls.clash} text-[clamp(1.8rem,4vw,3.5rem)] leading-tight`}>{m.title}</h2>
              </div>
              <p className="text-[#C0B298] font-bold text-base mb-4">{m.tagline}</p>
              <p className="text-[#f9f5ef]/60 leading-relaxed mb-8">{m.body}</p>
              <div className="grid grid-cols-2 gap-3">
                {m.data.map((d) => (
                  <div key={d} className="flex items-center gap-2 text-sm text-[#f9f5ef]/70">
                    <ArrowRight size={12} className="text-[#C0B298] shrink-0" /> {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Mock UI panel */}
            <div className={`bg-[#0f0a05] border border-white/10 rounded-2xl overflow-hidden ${i % 2 === 1 ? "md:order-1" : ""}`}>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#C0B298]/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="text-[10px] text-[#f9f5ef]/30 ml-2 tracking-widest uppercase">{m.title}</span>
              </div>
              <div className="p-6 space-y-3">
                {m.data.map((d, j) => (
                  <div key={j} className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="text-sm text-[#f9f5ef]/60">{d}</span>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-[#C0B298]/15 text-[#C0B298] font-bold uppercase tracking-wider">Active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="py-24 px-6 md:px-12 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className={`${cls.clash} text-[clamp(2.5rem,6vw,5rem)] leading-tight mb-6`}>
            READY TO SEE IT<br /><span className="text-[#C0B298]">IN ACTION?</span>
          </h2>
          <Link href="/demo" className="inline-block bg-[#C0B298] text-[#1a1008] px-10 py-4 rounded-full text-sm font-black uppercase tracking-widest hover:bg-[#f9f5ef] transition-colors">
            Launch Demo →
          </Link>
        </div>
      </section>
    </div>
  );
}
