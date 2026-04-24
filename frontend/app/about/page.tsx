"use client";
import Navbar from "../components/Navbar";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const cls = {
  page: "min-h-screen bg-[#1a1008] text-[#f9f5ef] font-['Inter',sans-serif] selection:bg-[#C0B298] selection:text-[#1a1008]",
  clash: "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase",
  label: "text-[10px] tracking-[0.4em] text-[#C0B298] uppercase font-bold",
};

export default function AboutPage() {
  return (
    <div className={cls.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');`}</style>
      <Navbar />

      {/* Hero */}
      <section className="pt-40 pb-32 px-6 md:px-12 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <p className={cls.label}>About</p>
          <h1 className={`${cls.clash} text-[clamp(3rem,8vw,8rem)] leading-[0.88] mt-4`}>
            WE MAKE<br />CONTRACTS<br /><span className="text-[#C0B298]">SPEAK UP.</span>
          </h1>
        </div>
      </section>

      {/* Problem */}
      <section className="py-24 px-6 md:px-12 border-b border-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          <div>
            <p className={cls.label}>The Problem</p>
            <h2 className={`${cls.clash} text-[clamp(2rem,4vw,3.5rem)] leading-tight mt-4 mb-6`}>
              CONTRACTS ARE SIGNED AND FORGOTTEN.
            </h2>
            <p className="text-[#f9f5ef]/60 leading-relaxed text-base">
              Every financial contract has obligations. Minimum cash balances. Revenue thresholds. Debt ratios. Interest payment dates. These covenants are in the fine print of every loan, every vendor agreement, every partnership deed.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            <p className="text-[#f9f5ef]/60 leading-relaxed text-base">
              And yet, financial teams track them in spreadsheets. Or they don't track them at all. The breach notice arrives 90 days after the problem started. By then, it's expensive — penalties, renegotiations, loss of lender trust.
            </p>
            <p className="text-[#f9f5ef]/60 leading-relaxed text-base">
              In India alone, 63 million MSMEs have active credit lines. Default rates are rising. The infrastructure for covenant monitoring simply didn't exist at this scale — until now.
            </p>
          </div>
        </div>
      </section>

      {/* Why Now */}
      <section className="py-24 px-6 md:px-12 border-b border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <p className={cls.label}>Why Now</p>
          <h2 className={`${cls.clash} text-[clamp(2rem,4vw,3.5rem)] leading-tight mt-4 mb-12`}>
            THE MOMENT IS EXACTLY RIGHT.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: "01", title: "LLMs can read contracts", body: "Modern language models can extract structured obligations from unstructured legal text with high accuracy. Two years ago, this wasn't reliable. Today, it is." },
              { n: "02", title: "Lending is exploding", body: "India's NBFC sector is growing 18% YoY. Startups are raising venture debt. The number of financial contracts being signed is growing faster than the teams managing them." },
              { n: "03", title: "Regulators are watching", body: "RBI is tightening early warning system requirements for lenders. Covenant monitoring is moving from good practice to regulatory expectation." },
            ].map((it) => (
              <div key={it.n} className="border-t-2 border-[#C0B298] pt-6">
                <p className="text-[10px] tracking-widest font-bold text-[#C0B298] mb-3">{it.n}</p>
                <h3 className={`${cls.clash} text-lg mb-4`}>{it.title}</h3>
                <p className="text-sm text-[#f9f5ef]/60 leading-relaxed">{it.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="py-24 px-6 md:px-12 border-b border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <p className={cls.label}>Our Vision</p>
          <blockquote className={`${cls.clash} text-[clamp(2rem,5vw,4.5rem)] leading-[0.9] mt-6 mb-10`}>
            "A WORLD WHERE <span className="text-[#C0B298]">NO COVENANT</span> IS EVER MISSED — WHERE FINANCIAL AGREEMENTS ARE LIVING DOCUMENTS, NOT FORGOTTEN PAPER."
          </blockquote>
          <p className="text-[#f9f5ef]/50 text-base max-w-xl mx-auto">
            We're building the operating system for financial obligations — starting with covenant monitoring and expanding to the full contract lifecycle.
          </p>
        </div>
      </section>

      {/* Team / Values */}
      <section className="py-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <p className={cls.label}>Principles</p>
          <h2 className={`${cls.clash} text-[clamp(2rem,4vw,3rem)] leading-tight mt-4 mb-12`}>HOW WE BUILD</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: "High-trust output only", body: "Every AI extraction is confidence-scored. Uncertain outputs are flagged for human review, not silently passed through." },
              { title: "Explain everything", body: "Risk scores without explanations are useless to a CFO. Every output has a plain-English \"why\" attached." },
              { title: "Built for India's scale", body: "We're not porting a Western fintech product. We're building for Indian contracts, Indian lenders, and Indian regulatory context from day one." },
              { title: "Minimal interface, maximum clarity", body: "You're managing financial risk. You need information density without cognitive overload. We obsess over information hierarchy." },
            ].map((p) => (
              <div key={p.title} className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowRight size={14} className="text-[#C0B298]" />
                  <h3 className={`${cls.clash} text-base`}>{p.title}</h3>
                </div>
                <p className="text-sm text-[#f9f5ef]/60 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 md:px-12 border-t border-white/5 text-center bg-white/[0.02]">
        <div className="max-w-xl mx-auto">
          <h2 className={`${cls.clash} text-[clamp(2rem,5vw,4rem)] leading-tight mb-6`}>
            JOIN THE<br /><span className="text-[#C0B298]">WAITLIST.</span>
          </h2>
          <p className="text-[#f9f5ef]/50 mb-8 text-sm">We're onboarding early customers now. Limited spots.</p>
          <Link href="/signup" className="inline-block bg-[#C0B298] text-[#1a1008] px-10 py-4 rounded-full text-sm font-black uppercase tracking-widest hover:bg-[#f9f5ef] transition-colors">
            Request Access →
          </Link>
        </div>
      </section>
    </div>
  );
}
