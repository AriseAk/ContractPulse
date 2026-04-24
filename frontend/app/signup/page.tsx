"use client";

import React from "react";
import { Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const clashFont = "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase";
  const satoshiFont = "font-['Inter',sans-serif]";
  const bgDark = "#1a1008"; 

  return (
    <div
      style={{ background: bgDark }}
      className={`min-h-screen flex flex-col justify-center text-[#f9f5ef] overflow-hidden selection:bg-[#C0B298] selection:text-[#1a1008] ${satoshiFont} relative px-6 py-12`}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');
        
        @keyframes drift {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(-1deg); }
        }
      `}</style>
      
      {/* Ambient blobs */}
      <div className="absolute top-[30%] -right-[15%] w-[60vw] h-[60vw] rounded-full bg-[#3d1f0a] blur-[150px] opacity-70 pointer-events-none" />
      <div className="absolute bottom-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-[#c9922a] blur-[160px] opacity-10 pointer-events-none" />

      {/* Nav indicator */}
      <div className="absolute top-6 left-6 md:top-10 md:left-12 z-20">
        <Link href="/landingpage" className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase text-[#C0B298] hover:text-[#f9f5ef] transition-colors">
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>

      <div className="w-full max-w-[500px] mx-auto relative z-10 animate-[drift_6s_ease-in-out_infinite]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8 text-[#f9f5ef]">
          <Activity className="w-8 h-8 text-[#C0B298]" strokeWidth={3} />
          <span className={`${clashFont} text-3xl leading-none`}>CONTRACTPULSE</span>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl">
          <h2 className={`${clashFont} text-4xl mb-2 text-center`}>GET STARTED</h2>
          <p className="text-sm font-medium text-[#f9f5ef]/50 text-center mb-8">
            Create an account to monitor your covenants.
          </p>

          <form className="flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/70 mb-2 block ml-4">Full Name</label>
              <input 
                type="text" 
                placeholder="JANE DOE"
                className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-[#f9f5ef] px-6 py-4 rounded-full outline-none font-medium placeholder:text-[#f9f5ef]/30 focus:border-[#C0B298] transition-colors shadow-inner"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/70 mb-2 block ml-4">Email</label>
              <input 
                type="email" 
                placeholder="YOUR@COMPANY.COM"
                className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-[#f9f5ef] px-6 py-4 rounded-full outline-none font-medium placeholder:text-[#f9f5ef]/30 focus:border-[#C0B298] transition-colors shadow-inner"
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/70 mb-2 block ml-4">Password</label>
              <input 
                type="password" 
                placeholder="••••••••••••"
                className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-[#f9f5ef] px-6 py-4 rounded-full outline-none font-medium placeholder:text-[#f9f5ef]/30 focus:border-[#C0B298] transition-colors shadow-inner"
              />
            </div>

            <button type="button" className="bg-[#C0B298] text-[#1a1008] px-8 py-4 rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(192,178,152,0.2)] mt-6">
              Create Account
            </button>
          </form>

          <p className="text-center text-[11px] font-medium text-[#f9f5ef]/50 mt-8 uppercase tracking-widest">
            Already have an account?{" "}
            <Link href="/login" className="text-[#C0B298] font-bold hover:text-[#f9f5ef] transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
