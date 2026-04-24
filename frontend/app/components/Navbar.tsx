"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";

const NAV_LINKS = [
  { label: "Product",    href: "/product" },
  { label: "Demo",       href: "/demo" },
  { label: "Use Cases",  href: "/use-cases" },
  { label: "Pricing",    href: "/pricing" },
  { label: "About",      href: "/about" },
];

export default function Navbar() {
  const pathname = usePathname();
  const clashFont = "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase";

  return (
    <nav className="fixed top-0 inset-x-0 z-[100] px-6 py-4 md:px-12 md:py-5 flex items-center justify-between bg-[#1a1008]/80 backdrop-blur-xl border-b border-white/5">
      {/* Logo */}
      <Link href="/landingpage" className="flex items-center gap-2 no-underline">
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
      </div>

      {/* Auth */}
      <div className="flex gap-4 items-center">
        <Link href="/login" className="hidden md:block text-[10px] font-bold tracking-[0.15em] uppercase text-[#f9f5ef]/50 hover:text-[#C0B298] transition-colors">
          Login
        </Link>
        <Link href="/signup" className="bg-[#C0B298] text-[#1a1008] px-5 py-2 rounded-full text-[10px] font-black tracking-[0.15em] uppercase hover:bg-[#f9f5ef] transition-colors shadow-lg">
          Get Started
        </Link>
      </div>
    </nav>
  );
}
