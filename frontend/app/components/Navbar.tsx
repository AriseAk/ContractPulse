"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity } from "lucide-react";

const NAV_LINKS = [
  { label: "Product",    href: "/product" },
  { label: "Demo",       href: "/demo" },
  { label: "Forecast",   href: "/forecast" }, 
  // { label: "Use Cases",  href: "/use-cases" },
  { label: "Pricing",    href: "/pricing" },
  { label: "About",      href: "/about" },
  { label: "Compare",    href: "/compare" }, 
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const clashFont = "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase";
  
  const [authState, setAuthState] = useState({
    loading: true,
    authenticated: false,
    user: null as any
  });

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";
    fetch(`${backendUrl}/auth/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setAuthState({ loading: false, authenticated: true, user: data.user });
        } else {
          setAuthState({ loading: false, authenticated: false, user: null });
        }
      })
      .catch((err) => {
        console.error("Auth check failed:", err);
        setAuthState({ loading: false, authenticated: false, user: null });
      });
  }, [pathname]);

  const handleLogout = async () => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    try {
      await fetch(`${backendUrl}/auth/logout`, { method: "POST", credentials: "include" });
      setAuthState({ loading: false, authenticated: false, user: null });
      router.push("/landingpage");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <nav className="fixed top-0 inset-x-0 z-[100] px-6 py-4 md:px-12 md:py-5 flex items-center justify-between bg-[#1a1008]/80 backdrop-blur-xl border-b border-white/5">
      {/* Logo */}
      <Link href={authState.authenticated ? "/dashboard" : "/landingpage"} className="flex items-center gap-2 no-underline">
        <Activity className="w-6 h-6 text-[#C0B298]" strokeWidth={3} />
        <span className={`${clashFont} text-lg leading-none text-[#f9f5ef]`}>CONTRACTPULSE</span>
      </Link>

      {/* Links */}
      <div className="hidden md:flex gap-8 text-[11px] font-bold tracking-[0.2em] uppercase">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`transition-colors duration-200 no-underline ${
              pathname === l.href ? "text-[#C0B298]" : "text-[#f9f5ef]/50 hover:text-[#C0B298]"
            }`}
          >
            {l.label}
          </Link>
        ))}
        {authState.authenticated && (
           <Link
             href="/dashboard"
             className={`transition-colors duration-200 no-underline ${
               pathname === "/dashboard" ? "text-[#C0B298]" : "text-[#f9f5ef]/50 hover:text-[#C0B298]"
             }`}
           >
             Dashboard
           </Link>
        )}
      </div>

      {/* Auth Area */}
      <div className="flex gap-4 items-center">
        {!authState.loading && authState.authenticated ? (
          <div className="flex items-center gap-4">
            <span className="hidden md:block text-[10px] font-bold tracking-[0.15em] uppercase text-[#f9f5ef]/50">
              {authState.user?.name || "User"}
            </span>
            <button 
              onClick={handleLogout}
              className="bg-white/5 border border-white/10 text-[#f9f5ef] px-5 py-2 rounded-full text-[10px] font-black tracking-[0.15em] uppercase hover:bg-white/10 hover:text-red-400 transition-colors shadow-lg cursor-pointer"
            >
              Logout
            </button>
          </div>
        ) : !authState.loading ? (
          <>
            <Link href="/login" className="hidden md:block text-[10px] font-bold tracking-[0.15em] uppercase text-[#f9f5ef]/50 hover:text-[#C0B298] transition-colors">
              Login
            </Link>
            <Link href="/signup" className="bg-[#C0B298] text-[#1a1008] px-5 py-2 rounded-full text-[10px] font-black tracking-[0.15em] uppercase hover:bg-[#f9f5ef] transition-colors shadow-lg">
              Get Started
            </Link>
          </>
        ) : (
          <div className="animate-pulse bg-white/10 h-8 w-24 rounded-full"></div>
        )}
      </div>
    </nav>
  );
}