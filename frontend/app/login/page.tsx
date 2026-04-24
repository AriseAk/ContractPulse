"use client";

import React from "react";
import { Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  // 1. Define the dynamic backend URL here
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
          50% { transform: translateY(-12px) rotate(1deg); }
        }
      `}</style>
      
      {/* Ambient blobs */}
      <div className="absolute top-[10%] -left-[15%] w-[55vw] h-[55vw] rounded-full bg-[#3d1f0a] blur-[130px] opacity-70 pointer-events-none" />
      <div className="absolute bottom-[20%] -right-[10%] w-[45vw] h-[45vw] rounded-full bg-[#c9922a] blur-[160px] opacity-10 pointer-events-none" />

      {/* Nav indicator */}
      <div className="absolute top-6 left-6 md:top-10 md:left-12 z-20">
        <Link href="/landingpage" className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase text-[#C0B298] hover:text-[#f9f5ef] transition-colors">
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>

      <div className="w-full max-w-[480px] mx-auto relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10 text-[#f9f5ef]">
          <Activity className="w-8 h-8 text-[#C0B298]" strokeWidth={3} />
          <span className={`${clashFont} text-3xl leading-none`}>CONTRACTPULSE</span>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl">
          <h2 className={`${clashFont} text-4xl mb-2 text-center`}>WELCOME BACK</h2>
          <p className="text-sm font-medium text-[#f9f5ef]/50 text-center mb-8">
            Access your intelligent contract dashboard.
          </p>

          <form className="flex flex-col gap-4">
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

            <div className="flex justify-end mt-1">
              <a href="#" className="text-[10px] font-bold tracking-widest uppercase text-[#C0B298] hover:text-[#f9f5ef] transition-colors">
                Forgot Password?
              </a>
            </div>

            <button type="button" className="bg-[#C0B298] text-[#1a1008] px-8 py-4 rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(192,178,152,0.2)] mt-4">
              Sign In
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 border-t border-white/5"></div>
            <span className="text-[10px] uppercase tracking-widest text-[#f9f5ef]/30 font-bold">OR</span>
            <div className="flex-1 border-t border-white/5"></div>
          </div>

          {/* 2. Use the dynamic variable in the href */}
          <a href={`${backendUrl}/auth/login/google`} className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-[#f9f5ef] px-8 py-4 rounded-full text-sm font-black uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all shadow-inner">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </a>

          <p className="text-center text-[11px] font-medium text-[#f9f5ef]/50 mt-8 uppercase tracking-widest">
            Don't have an account?{" "}
            <Link href="/signup" className="text-[#C0B298] font-bold hover:text-[#f9f5ef] transition-colors">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}