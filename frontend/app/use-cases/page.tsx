"use client";
import Navbar from "../components/Navbar";
import Link from "next/link";
import { ArrowRight, Building2, Landmark, Rocket } from "lucide-react";

const cls = {
  page: "min-h-screen bg-[#1a1008] text-[#f9f5ef] font-['Inter',sans-serif] selection:bg-[#C0B298] selection:text-[#1a1008]",
  clash: "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase",
  label: "text-[10px] tracking-[0.4em] text-[#C0B298] uppercase font-bold",
};

const cases = [
  {
    icon: <Building2 size={32} className="text-[#C0B298]" />,
    audience: "CFO",
    headline: "Complete covenant visibility across every lender relationship.",
    problem: "Your company has 5 loan agreements, 3 vendor SLAs, and 2 partnership deeds. Each has financial covenants — debt ratios, minimum cash balances, EBITDA floors. You're tracking them in a spreadsheet that hasn't been updated in 6 weeks.",
    solution: "ContractPulse extracts every obligation automatically, maps them to your live financials, and shows breach risk in real time. Your weekly CFO report takes 10 minutes, not a full day.",
    outcomes: ["Zero missed covenant breaches", "60% reduction in compliance reporting time", "Single dashboard for all lender obligations", "Automated alerts 47 days before breach"],
    color: "#C0B298",
  },
  {
    icon: <Landmark size={32} className="text-[#C0B298]" />,
    audience: "NBFC / Lender",
    headline: "Monitor borrower covenant health across your entire loan book.",
    problem: "You've disbursed loans to 200 borrowers. Each loan agreement has financial tests. You have a 12-person credit team manually following up with borrowers every quarter. 3 defaults happened last year — all of them had detectable covenant stress 60+ days prior.",
    solution: "ContractPulse ingests all your loan agreements, tracks borrower-reported financials, and surfaces early warning signals portfolio-wide. Your credit team focuses on high-risk borrowers — not data entry.",
    outcomes: ["Portfolio-level breach risk dashboard", "60+ day advance warning on defaults", "Automated borrower data collection", "Risk-stratified loan book view"],
    color: "#a89070",
  },
  {
    icon: <Rocket size={32} className="text-[#C0B298]" />,
    audience: "Startup with Debt",
    headline: "Stop getting blindsided by covenants you forgot you signed.",
    problem: "You raised a venture debt round. The term sheet has covenants around minimum runway, monthly recurring revenue, and burn rate. You're focused on growth. One quarter later, your runway drops below the threshold — and your lender sends you a breach notice.",
    solution: "ContractPulse monitors your covenants continuously against your financials. When you're 6 weeks from a potential breach, you get an alert with a plain-English explanation and recommended actions.",
    outcomes: ["Never miss a covenant breach", "Scenario simulation before fundraising", "Lender-ready covenant compliance reports", "14-day free monitoring for new debt"],
    color: "#b89a78",
  },
];

export default function UseCasesPage() {
  return (
    <div className={cls.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');`}</style>
      <Navbar />

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 md:px-12 border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <p className={cls.label}>Use Cases</p>
          <h1 className={`${cls.clash} text-[clamp(3rem,8vw,7rem)] leading-[0.88] mt-4 mb-6`}>
            BUILT FOR<br />THE PEOPLE<br /><span className="text-[#C0B298]">WHO SIGN.</span>
          </h1>
          <p className="text-[#f9f5ef]/60 text-lg max-w-xl leading-relaxed">
            ContractPulse is used by CFOs managing lender relationships, NBFCs monitoring borrower portfolios, and startups that can't afford a covenant breach.
          </p>
        </div>
      </section>

      {/* Cases */}
      {cases.map((c, i) => (
        <section key={i} className="py-24 px-6 md:px-12 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-start gap-6 mb-16">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                {c.icon}
              </div>
              <div>
                <p className={cls.label}>{c.audience}</p>
                <h2 className={`${cls.clash} text-[clamp(1.5rem,3.5vw,3rem)] leading-tight mt-2 max-w-3xl`}>{c.headline}</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Problem */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <p className="text-[10px] tracking-[0.35em] font-bold uppercase text-red-400/80 mb-4">The Problem</p>
                <p className="text-[#f9f5ef]/70 text-sm leading-relaxed">{c.problem}</p>
              </div>

              {/* Solution */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <p className="text-[10px] tracking-[0.35em] font-bold uppercase text-[#C0B298] mb-4">Our Solution</p>
                <p className="text-[#f9f5ef]/70 text-sm leading-relaxed">{c.solution}</p>
              </div>

              {/* Outcomes */}
              <div className="bg-[#C0B298]/10 border border-[#C0B298]/20 rounded-2xl p-8">
                <p className="text-[10px] tracking-[0.35em] font-bold uppercase text-[#C0B298] mb-4">Outcomes</p>
                <div className="space-y-3">
                  {c.outcomes.map((o) => (
                    <div key={o} className="flex items-start gap-3 text-sm text-[#f9f5ef]/80">
                      <ArrowRight size={14} className="text-[#C0B298] mt-0.5 shrink-0" />
                      {o}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="py-24 px-6 md:px-12 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className={`${cls.clash} text-[clamp(2rem,5vw,4rem)] leading-tight mb-6`}>
            WHICH ONE<br /><span className="text-[#C0B298]">ARE YOU?</span>
          </h2>
          <p className="text-[#f9f5ef]/50 mb-8">Start with a 14-day demo — no credit card required.</p>
          <Link href="/demo" className="inline-block bg-[#C0B298] text-[#1a1008] px-10 py-4 rounded-full text-sm font-black uppercase tracking-widest hover:bg-[#f9f5ef] transition-colors">
            Try Demo →
          </Link>
        </div>
      </section>
    </div>
  );
}
