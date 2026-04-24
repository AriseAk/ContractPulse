"use client";

import React, { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import Navbar from "../components/Navbar";

/* ─── Intersection reveal hook ─── */
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── Animated number component ─── */
function Counter({ target, suffix = "", active }: { target: number, suffix?: string, active: boolean }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let cur = 0;
    const step = target / 55;
    const id = setInterval(() => {
      cur += step;
      if (cur >= target) {
        setVal(target);
        clearInterval(id);
      } else {
        setVal(Math.floor(cur));
      }
    }, 16);
    return () => clearInterval(id);
  }, [active, target]);
  return <>{val}{suffix}</>;
}

export default function ContractPulseLanding() {
  /* ─── Section Refs ─── */
  const { ref: probRef, inView: probIn } = useInView();
  const { ref: howRef, inView: howIn } = useInView();
  const { ref: featRef, inView: featIn } = useInView();
  const { ref: statRef, inView: statIn } = useInView();
  const { ref: pricRef, inView: pricIn } = useInView();
  const { ref: ctaRef, inView: ctaIn } = useInView();

  // Typography & Animation Constants
  const clashFont = "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase";
  const satoshiFont = "font-['Inter',sans-serif]";
  const revealBase = "transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"; // Fluid elastic ease
  const revealIn = "opacity-100 translate-y-0";
  const revealOut = "opacity-0 translate-y-16";

  // Core Palette
  const bgDark = "#1a1008"; // Deep Void
  const textLight = "#f9f5ef"; // Cream
  const accentBeige = "#C0B298"; // Shout Color

  return (
    <div
      style={{ background: bgDark }}
      className={`min-h-screen text-[#f9f5ef] overflow-x-hidden selection:bg-[#C0B298] selection:text-[#1a1008] ${satoshiFont}`}
    >
      {/* ── FONTS + KEYFRAMES ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');

        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${bgDark}; }
        ::-webkit-scrollbar-thumb { background: ${accentBeige}; border-radius: 4px; }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>

      <Navbar />

      {/* ══════════════════════════════════════════
          HERO (Liquid Cut)
      ══════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-20 px-4 md:px-8 overflow-hidden">
        
        {/* Massive Background Text */}
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex flex-col items-center justify-center z-0 pointer-events-none opacity-90">
          <h1 className={`${clashFont} text-[6vw] leading-[0.75] text-[#f9f5ef] text-center whitespace-nowrap`}>
            CONTRACTS DON'T WARN YOU.
          </h1>
          <div className="w-24 md:w-32 h-[4px] bg-[#C0B298] my-6 md:my-8 rounded-full"></div>
          <h1 className={`${clashFont} text-[6vw] leading-[0.75] text-[#f9f5ef] text-center whitespace-nowrap`}>
            <span className="text-[#C0B298]">WE DO.</span>
          </h1>
        </div>

        {/* Main Dark Brown Container - Liquid Asymmetrical Wave (rounded-br-[120px]) */}
        <div className="bg-gradient-to-br from-[#5c3a1e] via-[#3d2010] to-[#1a1008] w-full max-w-7xl rounded-[40px] md:rounded-tl-[40px] md:rounded-tr-[40px] md:rounded-bl-[40px] md:rounded-br-[120px] mt-[35vh] relative z-10 p-8 md:pt-16 md:pb-16 flex flex-col md:flex-row justify-between items-end min-h-[250px] shadow-[0_30px_80px_rgba(0,0,0,0.6)] border border-[#C0B298]/20">
          
          {/* Center Pop-out Graphic */}
          <div className="absolute left-1/2 top-40 -translate-x-1/2 -translate-y-[55%] z-20 flex flex-col items-center">
            <div className="relative w-48 h-56 md:w-64 md:h-62 animate-[float_6s_ease-in-out_infinite]">
              <img 
                src="/image.jpeg" 
                alt="Product Interface Placeholder" 
                className="w-full h-full object-cover rounded-[32px] border-4 border-white/10 shadow-2xl"
              />
            </div>
          </div>

          {/* Left Text */}
          <div className="w-full md:w-[40%] mb-12 md:mb-0 pt-28 md:pt-0">
            <h2 className={`${clashFont} text-[#f9f5ef] text-2xl md:text-[2.2rem] leading-[1] tracking-tight drop-shadow-md`}>
              WE TRACK OBLIGATIONS, PREDICT BREACH RISK, AND SHOW EXACTLY WHEN THINGS GO WRONG.
            </h2>
          </div>

          {/* Right Text & CTA */}
          <div className="w-full md:w-[35%] flex flex-col md:items-end text-left md:text-right">
            <h3 className={`${clashFont} text-[#C0B298] text-xl md:text-2xl leading-[1.1] mb-8 drop-shadow-sm`}>
              A RISK PROTOCOL FOR THE AGENTIC ERA.
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Link href="/demo" className="bg-[#C0B298] text-[#1a1008] px-8 py-4 rounded-full text-sm font-black uppercase tracking-widest hover:bg-[#f9f5ef] transition-colors shadow-[0_10px_30px_rgba(192,178,152,0.3)]">
                Start Building
              </Link>
              <Link href="/product" className="bg-[#1a1008]/50 backdrop-blur-md border border-[#C0B298]/50 text-[#C0B298] px-8 py-4 rounded-full text-sm font-black uppercase tracking-widest hover:bg-[#C0B298] hover:text-[#1a1008] transition-all">
                Explore Tech
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS & PROBLEM (Glassmorphic void)
      ══════════════════════════════════════════ */}
      <section id="problem" className="py-24 px-6 md:px-12 relative">
        <div ref={probRef} className="max-w-7xl mx-auto">
          <div className={`mb-20 ${revealBase} ${probIn ? revealIn : revealOut}`}>
            <h2 className={`${clashFont} text-[clamp(4rem,8vw,8rem)] leading-[0.85] text-[#f9f5ef]`}>
              SILENT BREACHES.<br/>LOUD <span className="text-[#C0B298]">WARNINGS.</span>
            </h2>
          </div>

          <div ref={statRef} className={`grid grid-cols-1 md:grid-cols-4 gap-4 ${revealBase} ${statIn ? revealIn : revealOut}`}>
            {[
              { val: 60, suffix: "%", label: "SME Loan Defaults", sub: "Start as unnoticed breaches" },
              { val: 90, suffix: "+", label: "Days Before Detection", sub: "Average breach time" },
              { val: 63, suffix: "M", label: "MSMEs in India", sub: "Market opportunity" },
              { val: 47, suffix: "", label: "Days Earlier", sub: "Detection with ContractPulse" },
            ].map((s, i) => (
              // Glassmorphic Cards
              <div key={i} className="bg-white/5 backdrop-blur-2xl p-8 rounded-[32px] border border-white/10 flex flex-col justify-between shadow-2xl">
                <p className={`${clashFont} text-5xl md:text-6xl text-[#C0B298] mb-8`}>
                  <Counter target={s.val} suffix={s.suffix} active={statIn} />
                </p>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#f9f5ef] mb-2">{s.label}</p>
                  <p className="text-xs font-normal text-[#f9f5ef]/60">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS (Liquid Accent Cut)
      ══════════════════════════════════════════ */}
      <section id="how" className="py-24 px-6 md:px-12">
        {/* Asymmetrical Block */}
        <div ref={howRef} className="max-w-7xl mx-auto bg-gradient-to-br from-[#5c3a1e] via-[#3d2010] to-[#1a1008] border border-[#C0B298]/20 rounded-[40px] md:rounded-tr-[120px] md:rounded-bl-[120px] p-8 md:p-16 text-[#f9f5ef] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <h2 className={`${clashFont} text-[#f9f5ef] text-[clamp(3rem,6vw,6rem)] leading-[0.85] mb-16 text-center`}>
            FROM UPLOAD TO<br/>LIVE MONITORING
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { n: "01", title: "UPLOAD", body: "Drop any financial contract — loan agreement, vendor SLA, partnership deed." },
              { n: "02", title: "EXTRACT", body: "AI classifies every clause, scores confidence, flags uncertainty for review." },
              { n: "03", title: "MONITOR", body: "Live dashboard maps your metrics against every covenant in real time." },
              { n: "04", title: "ALERT", body: "Breach proximity scores and early warnings arrive before problems compound." },
            ].map((s, i) => (
              <div key={i} className={`flex flex-col text-[#f9f5ef] ${revealBase} ${howIn ? revealIn : revealOut}`} style={{ transitionDelay: `${i * 150}ms` }}>
                <span className="text-xl font-black mb-4 border-b-4 border-[#C0B298] text-[#C0B298] pb-2 w-12">{s.n}</span>
                <h3 className={`${clashFont} text-2xl mb-4`}>{s.title}</h3>
                <p className="text-sm font-medium opacity-80 leading-relaxed text-[#f9f5ef]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES (Small, Glassmorphic Cards)
      ══════════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 md:px-12">
        <div ref={featRef} className="max-w-7xl mx-auto">
          <h2 className={`${clashFont} text-[clamp(4rem,8vw,8rem)] leading-[0.85] text-[#f9f5ef] text-right mb-16`}>
            THE <span className="text-[#C0B298]">PROTOCOL</span>
          </h2>

          {/* Narrow Grid Container to force small cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
            {[
              { title: "Obligation Extraction", body: "AI parses every clause — payment terms, covenants, SLAs — scoring confidence and flagging anything uncertain for human review." },
              { title: "Live Breach Monitoring", body: "Real-time proximity scores (0–100%) show how close each covenant is to breach, with trend-based predictions." },
              { title: "Cross-Contract Conflicts", body: "Surfaces contradictions across your entire portfolio — before a vendor clause quietly conflicts with a bank loan." },
              { title: "Scenario Simulator", body: "Model a 20% revenue dip or delayed payment and instantly see the ripple across every obligation." },
            ].map((f, i) => (
              <div 
                key={i} 
                // Glassmorphic styling with tight padding and rounded-32px
                className={`bg-white/5 backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-[32px] hover:bg-white/10 transition-colors shadow-2xl ${revealBase} ${featIn ? revealIn : revealOut}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <h3 className={`${clashFont} text-xl md:text-2xl text-[#f9f5ef] mb-3`}>{f.title}</h3>
                <p className="text-sm text-[#f9f5ef]/70 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6 md:px-12">
        <div ref={pricRef} className="max-w-7xl mx-auto">
          <h2 className={`${clashFont} text-[clamp(2.5rem,5vw,5rem)] leading-[0.85] text-[#f9f5ef] mb-12`}>
            TRANSPARENT<br/>SCALING
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            
            {/* Growth Tier - Dark Liquid Box */}
            <div className={`bg-gradient-to-br from-[#5c3a1e] via-[#3d2010] to-[#1a1008] text-[#f9f5ef] p-6 md:p-8 rounded-[32px] md:rounded-bl-[60px] flex flex-col justify-between shadow-[0_30px_80px_rgba(0,0,0,0.6)] border border-[#C0B298]/20 ${revealBase} ${pricIn ? revealIn : revealOut}`}>
              <div>
                {/* Pill Badge */}
                <p className="text-[10px] font-black tracking-widest uppercase mb-5 border-2 border-[#C0B298] text-[#C0B298] inline-flex items-center justify-center px-4 py-1.5 rounded-full">Growth</p>
                <div className="flex items-end gap-1.5 mb-3">
                  <span className={`${clashFont} text-4xl md:text-5xl leading-none`}>₹4,999</span>
                  <span className="text-sm font-bold pb-0.5">/mo</span>
                </div>
                <p className="text-sm font-bold text-[#C0B298] mb-6">For CFOs and finance teams. Up to 50 contracts.</p>
                
                <div className="space-y-2 mb-8">
                  {["Up to 50 contracts", "Live breach monitoring", "Scenario simulator", "Email alerts"].map((item) => (
                    <div key={item} className="flex items-center gap-3 border-b border-[#C0B298]/20 pb-2 font-medium text-xs md:text-sm">
                      <ArrowRight size={16} className="text-[#C0B298]" /> {item}
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full bg-[#C0B298] text-[#1a1008] py-4 rounded-full text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_20px_rgba(192,178,152,0.2)]">
                Deploy Growth
              </button>
            </div>

            {/* Enterprise Tier - Glassmorphic Box */}
            <div className={`bg-white/5 backdrop-blur-2xl text-[#f9f5ef] border border-white/10 p-6 md:p-8 rounded-[32px] md:rounded-tr-[60px] flex flex-col justify-between shadow-2xl ${revealBase} ${pricIn ? revealIn : revealOut}`} style={{ transitionDelay: "150ms" }}>
              <div>
                <p className="text-[10px] font-black tracking-widest uppercase mb-5 border-2 border-[#C0B298] text-[#C0B298] inline-flex items-center justify-center px-4 py-1.5 rounded-full">Enterprise</p>
                <div className="flex items-end gap-1.5 mb-3">
                  <span className={`${clashFont} text-4xl md:text-5xl leading-none text-[#C0B298]`}>₹2L</span>
                  <span className="text-sm font-bold pb-0.5 text-[#f9f5ef]/60">/mo</span>
                </div>
                <p className="text-sm font-normal text-[#f9f5ef]/60 mb-6">Portfolio-level monitoring for NBFCs and large lenders.</p>
                
                <div className="space-y-2 mb-8">
                  {["Unlimited contracts", "API integrations", "Dedicated support", "Custom reporting"].map((item) => (
                    <div key={item} className="flex items-center gap-3 border-b border-white/5 pb-2 font-medium text-xs md:text-sm">
                      <ArrowRight size={16} className="text-[#C0B298]" /> {item}
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full bg-[#C0B298] text-[#1a1008] py-4 rounded-full text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_20px_rgba(192,178,152,0.2)]">
                Contact Sales
              </button>
            </div>
            
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER / CTA (Void Area)
      ══════════════════════════════════════════ */}
      <footer id="cta" className="pt-32 pb-12 px-6 md:px-12 border-t border-white/5 bg-[#0C0A09]">
        <div ref={ctaRef} className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <h2 className={`${clashFont} text-[clamp(4rem,9vw,9rem)] leading-[0.8] text-[#f9f5ef] mb-12 ${revealBase} ${ctaIn ? revealIn : revealOut}`}>
            GIVE YOUR<br/>CONTRACTS A<br/><span className="text-[#C0B298]">HEARTBEAT.</span>
          </h2>
          
          <div className={`flex flex-col sm:flex-row w-full max-w-xl gap-4 mb-24 ${revealBase} ${ctaIn ? revealIn : revealOut}`} style={{ transitionDelay: "150ms" }}>
            {/* Input modified for pill-shape to match system */}
            <input
              type="email"
              placeholder="YOUR@COMPANY.COM"
              className="flex-grow bg-white/5 backdrop-blur-md border border-white/10 text-[#f9f5ef] px-8 py-5 rounded-full outline-none font-medium placeholder:text-[#f9f5ef]/30 focus:border-[#C0B298] transition-colors"
            />
            <button className="bg-[#C0B298] text-[#1a1008] px-10 py-5 rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(192,178,152,0.2)]">
              Access
            </button>
          </div>

          <div className="w-full flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/5 text-[10px] font-bold text-[#f9f5ef]/50 tracking-widest uppercase">
            <div className="flex items-center gap-2 mb-4 md:mb-0 text-[#f9f5ef]">
              <Activity className="w-5 h-5 text-[#C0B298]" /> CONTRACTPULSE
            </div>
            <p>© 2026 CONTRACTPULSE. ALL RIGHTS RESERVED.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}