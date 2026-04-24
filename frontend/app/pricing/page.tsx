"use client";
import Navbar from "../components/Navbar";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";

const cls = {
  page: "min-h-screen bg-[#1a1008] text-[#f9f5ef] font-['Inter',sans-serif] selection:bg-[#C0B298] selection:text-[#1a1008]",
  clash: "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase",
  label: "text-[10px] tracking-[0.4em] text-[#C0B298] uppercase font-bold",
};

const tiers = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    period: "/ 14 days",
    desc: "Explore ContractPulse with 3 sample contracts. No credit card required.",
    highlight: false,
    cta: "Start Free Demo",
    ctaHref: "/demo",
    features: [
      "3 contracts",
      "Obligation extraction",
      "Risk score (read-only)",
      "Sample breach report",
      "1 user",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "₹4,999",
    period: "/ month",
    desc: "For finance teams actively managing 5–50 contracts and lender relationships.",
    highlight: true,
    cta: "Get Started",
    ctaHref: "/signup",
    features: [
      "Up to 50 contracts",
      "Live breach monitoring",
      "Time-to-breach projections",
      "Scenario simulator",
      "Cross-contract conflict detection",
      "Email + Slack alerts",
      "5 users",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "Portfolio-level monitoring for NBFCs, large lenders, and multi-entity corporates.",
    highlight: false,
    cta: "Contact Sales",
    ctaHref: "mailto:sales@contractpulse.in",
    features: [
      "Unlimited contracts",
      "Portfolio risk view",
      "API integrations",
      "Borrower data collection",
      "Custom covenant templates",
      "Dedicated CSM",
      "Unlimited users",
      "SLA & custom reporting",
    ],
  },
];

const comparison = [
  { feature: "Contracts",               starter: "3",     growth: "50",        enterprise: "Unlimited" },
  { feature: "Obligation extraction",   starter: true,    growth: true,         enterprise: true },
  { feature: "Risk scoring",            starter: "View",  growth: true,         enterprise: true },
  { feature: "Time-to-breach",         starter: false,   growth: true,         enterprise: true },
  { feature: "Scenario simulator",      starter: false,   growth: true,         enterprise: true },
  { feature: "Portfolio view",          starter: false,   growth: false,        enterprise: true },
  { feature: "API access",             starter: false,   growth: false,        enterprise: true },
  { feature: "Alerts",                 starter: "Email", growth: "Email+Slack", enterprise: "Custom" },
  { feature: "Users",                  starter: "1",     growth: "5",          enterprise: "Unlimited" },
  { feature: "Support",               starter: "Email", growth: "Priority",    enterprise: "Dedicated CSM" },
];

function FeatureCell({ val }: { val: boolean | string }) {
  if (val === true) return <Check size={16} className="text-[#C0B298] mx-auto" />;
  if (val === false) return <span className="text-[#f9f5ef]/20 mx-auto block text-center">—</span>;
  return <span className="text-sm text-[#f9f5ef]/70 text-center block">{val}</span>;
}

export default function PricingPage() {
  return (
    <div className={cls.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');`}</style>
      <Navbar />

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 md:px-12 border-b border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <p className={cls.label}>Pricing</p>
          <h1 className={`${cls.clash} text-[clamp(3rem,8vw,7rem)] leading-[0.88] mt-4 mb-6`}>
            TRANSPARENT<br /><span className="text-[#C0B298]">SCALING</span>
          </h1>
          <p className="text-[#f9f5ef]/60 text-lg leading-relaxed">
            Start free. Scale when you need. No surprises in the contract — promise.
          </p>
        </div>
      </section>

      {/* Tier cards */}
      <section className="py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.id}
              className={`flex flex-col justify-between rounded-2xl p-8 ${
                t.highlight
                  ? "bg-[#C0B298] text-[#1a1008]"
                  : "bg-white/5 border border-white/10 text-[#f9f5ef]"
              }`}
            >
              <div>
                <p className={`text-[10px] font-black tracking-widest uppercase mb-6 inline-flex px-3 py-1 rounded-full border-2 ${t.highlight ? "border-[#1a1008]/30" : "border-[#C0B298]/40 text-[#C0B298]"}`}>
                  {t.name}
                </p>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className={`font-['Space_Grotesk',sans-serif] font-bold tracking-tighter text-4xl md:text-5xl leading-none`}>{t.price}</span>
                  {t.period && <span className={`text-sm pb-0.5 ${t.highlight ? "text-[#1a1008]/60" : "text-[#f9f5ef]/40"}`}>{t.period}</span>}
                </div>
                <p className={`text-sm mb-8 leading-relaxed ${t.highlight ? "text-[#1a1008]/70" : "text-[#f9f5ef]/50"}`}>{t.desc}</p>
                <div className="space-y-3 mb-10">
                  {t.features.map((f) => (
                    <div key={f} className={`flex items-center gap-3 text-sm pb-3 border-b ${t.highlight ? "border-[#1a1008]/10" : "border-white/5"}`}>
                      <ArrowRight size={13} className={t.highlight ? "text-[#1a1008]" : "text-[#C0B298]"} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              <Link
                href={t.ctaHref}
                className={`w-full py-3.5 rounded-full text-[11px] font-black uppercase tracking-widest text-center block transition-colors ${
                  t.highlight
                    ? "bg-[#1a1008] text-[#f9f5ef] hover:bg-[#2d1a0e]"
                    : "bg-[#C0B298] text-[#1a1008] hover:bg-[#f9f5ef]"
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="pb-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <h2 className={`${cls.clash} text-2xl mb-8 text-center`}>Full Comparison</h2>
          <div className="border border-white/10 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 bg-white/5 border-b border-white/10 px-6 py-4 text-[11px] font-bold tracking-widest uppercase text-[#C0B298]">
              <span>Feature</span>
              <span className="text-center">Starter</span>
              <span className="text-center">Growth</span>
              <span className="text-center">Enterprise</span>
            </div>
            {comparison.map((row, i) => (
              <div key={i} className={`grid grid-cols-4 px-6 py-4 border-b border-white/5 items-center ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                <span className="text-sm text-[#f9f5ef]/70">{row.feature}</span>
                <FeatureCell val={row.starter} />
                <FeatureCell val={row.growth} />
                <FeatureCell val={row.enterprise} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ / Bottom CTA */}
      <section className="py-24 px-6 md:px-12 border-t border-white/5 bg-white/[0.02] text-center">
        <div className="max-w-xl mx-auto">
          <h2 className={`${cls.clash} text-[clamp(2rem,4vw,3.5rem)] leading-tight mb-4`}>
            QUESTIONS?
          </h2>
          <p className="text-[#f9f5ef]/50 mb-8 text-sm">We're happy to walk you through the right plan. Reach out directly.</p>
          <a href="mailto:hello@contractpulse.in" className="inline-block border border-[#C0B298]/40 text-[#C0B298] px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-[#C0B298] hover:text-[#1a1008] transition-colors">
            hello@contractpulse.in
          </a>
        </div>
      </section>
    </div>
  );
}
