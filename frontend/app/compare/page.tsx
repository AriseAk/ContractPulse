"use client";

import React, { useState, useCallback } from "react";
import { Activity, AlertTriangle, CheckCircle, HelpCircle, ChevronDown, Zap, X } from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Clause {
  clause_type: string;
  clause_text: string;
  contract: string;
}

interface Conflict {
  clause_type: string;
  clause_a: string;
  clause_b: string;
  predicted_label: string;
  predicted_score: number;
  contradiction_score: number;
  all_scores: Record<string, number>;
  token_length: number;
  uncertain: boolean;
}

interface AnalysisResult {
  clauses_a: Clause[];
  clauses_b: Clause[];
  conflicts: Conflict[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CLAUSE_COLORS: Record<string, string> = {
  termination:        "rgba(220, 100, 60, 0.25)",
  warranty:           "rgba(80, 160, 120, 0.25)",
  indemnification:    "rgba(180, 80, 200, 0.25)",
  ip_ownership:       "rgba(60, 140, 220, 0.25)",
  dispute_resolution: "rgba(220, 180, 40, 0.25)",
  confidentiality:    "rgba(200, 80, 120, 0.25)",
  liability_cap:      "rgba(100, 180, 220, 0.25)",
  governing_law:      "rgba(150, 220, 80, 0.25)",
  payment:            "rgba(220, 140, 40, 0.25)",
  non_compete:        "rgba(140, 100, 220, 0.25)",
  force_majeure:      "rgba(80, 200, 180, 0.25)",
  assignment:         "rgba(220, 160, 100, 0.25)",
};

const CLAUSE_BORDER: Record<string, string> = {
  termination:        "#DC643C",
  warranty:           "#50A078",
  indemnification:    "#B450C8",
  ip_ownership:       "#3C8CDC",
  dispute_resolution: "#DCB428",
  confidentiality:    "#C85078",
  liability_cap:      "#64B4DC",
  governing_law:      "#96DC50",
  payment:            "#DC8C28",
  non_compete:        "#8C64DC",
  force_majeure:      "#50C8B4",
  assignment:         "#DC9C64",
};

const clashFont = "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase";
const bgDark    = "#1a1008";
const textLight = "#f9f5ef";
const accent    = "#C0B298";

const SAMPLE_A = `VENDOR AGREEMENT 2024

Termination: Either party may terminate this agreement for convenience upon 30 days written notice to the other party.

Warranties: Seller warrants that all deliverables shall be free from defects for a period of 24 months from the date of acceptance by Buyer.

Dispute Resolution: All disputes arising under this agreement shall be resolved through binding arbitration in New York under AAA rules.

Intellectual Property: The Licensee is granted an exclusive, worldwide, perpetual license to use the Software and all derivative works.

Confidentiality: Neither party shall disclose Confidential Information to any third party without prior written consent of the disclosing party.

Governing Law: This agreement shall be governed by the laws of Delaware.`;

const SAMPLE_B = `MASTER SERVICES AGREEMENT 2024

Termination: This agreement may only be terminated for cause, specifically material breach that remains uncured for 60 days after written notice.

Warranties: Seller disclaims all warranties, express or implied, including any warranty of merchantability or fitness for a particular purpose.

Dispute Resolution: Either party may bring suit in any court of competent jurisdiction to resolve disputes arising under this agreement.

Intellectual Property: The license granted herein is non-exclusive, limited to the United States, and valid for 12 months only from the effective date.

Confidentiality: Confidential Information must not be shared with outside parties unless the disclosing party agrees in writing beforehand.

Governing Law: This agreement is governed by the laws of California.`;

// ── Sub-components ─────────────────────────────────────────────────────────────

const displayPct = (score: number) => Math.min(Math.round(score * 100), 99);

function ClauseTag({ type }: { type: string }) {
  const label = type.replace(/_/g, " ");
  return (
    <span
      style={{
        background: CLAUSE_COLORS[type] ?? "rgba(192,178,152,0.2)",
        border: `1px solid ${CLAUSE_BORDER[type] ?? accent}`,
        color: CLAUSE_BORDER[type] ?? accent,
      }}
      className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mr-1 mb-1"
    >
      {label}
    </span>
  );
}

function ClauseCard({ clause, hasConflict }: { clause: Clause; hasConflict: boolean }) {
  return (
    <div
      style={{
        background: CLAUSE_COLORS[clause.clause_type] ?? "rgba(192,178,152,0.1)",
        borderLeft: `3px solid ${CLAUSE_BORDER[clause.clause_type] ?? accent}`,
        ...(hasConflict ? { boxShadow: `0 0 12px ${CLAUSE_BORDER[clause.clause_type]}55` } : {}),
      }}
      className="rounded-[16px] p-4 mb-3 relative backdrop-blur-sm"
    >
      {hasConflict && (
        <span className="absolute top-2 right-2 bg-red-500/20 border border-red-400/40 text-red-400 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1">
          <AlertTriangle size={8} /> CONFLICT
        </span>
      )}
      <ClauseTag type={clause.clause_type} />
      <p className="text-[13px] text-[#f9f5ef]/85 leading-relaxed mt-1 font-medium">
        {clause.clause_text}
      </p>
    </div>
  );
}

function ConflictRow({ conflict, idx }: { conflict: Conflict; idx: number }) {
  const [open, setOpen] = useState(idx === 0);
  const pct = displayPct(conflict.predicted_score);
  const isConflict = conflict.predicted_label === "contradiction";
  const isUncertain = conflict.uncertain;

  return (
    <div
      style={{
        borderLeft: `3px solid ${
          isUncertain ? "#DCB428" : isConflict ? "#DC643C" : "#50A078"
        }`,
      }}
      className="bg-white/5 backdrop-blur-xl rounded-[20px] overflow-hidden mb-3"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isUncertain ? (
            <HelpCircle size={16} className="text-yellow-400 shrink-0" />
          ) : isConflict ? (
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
          ) : (
            <CheckCircle size={16} className="text-green-400 shrink-0" />
          )}
          <span className={`${clashFont} text-sm text-[#f9f5ef]`}>
            {conflict.clause_type.replace(/_/g, " ")}
          </span>
          {isUncertain && (
            <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400 border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 rounded-full">
              Review Needed
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Score bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-white/10">
              <div
                style={{
                  width: `${pct}%`,
                  background: isUncertain ? "#DCB428" : isConflict ? "#DC643C" : "#50A078",
                }}
                className="h-full rounded-full transition-all duration-700"
              />
            </div>
            <span className="text-xs font-black text-[#f9f5ef]/60">{pct}%</span>
          </div>
          <ChevronDown
            size={16}
            className={`text-[#C0B298] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div
              style={{ background: CLAUSE_COLORS[conflict.clause_type] ?? "rgba(192,178,152,0.1)" }}
              className="rounded-[14px] p-4"
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-[#C0B298] mb-2">Contract A</p>
              <p className="text-sm text-[#f9f5ef]/85 leading-relaxed">{conflict.clause_a}</p>
            </div>
            <div
              style={{ background: CLAUSE_COLORS[conflict.clause_type] ?? "rgba(192,178,152,0.1)" }}
              className="rounded-[14px] p-4"
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-[#C0B298] mb-2">Contract B</p>
              <p className="text-sm text-[#f9f5ef]/85 leading-relaxed">{conflict.clause_b}</p>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Object.entries(conflict.all_scores).map(([label, score]) => (
              <div key={label} className="bg-white/5 rounded-[12px] p-3 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#f9f5ef]/50 mb-1">
                  {label}
                </p>
                <p className={`text-lg font-black ${clashFont} ${
                  label === "contradiction" ? "text-red-400" :
                  label === "entailment"   ? "text-green-400" : "text-yellow-400"
                }`}>
                  {displayPct(score)}%
                </p>
              </div>
            ))}
          </div>

          <p className="text-[10px] font-bold text-[#f9f5ef]/30 mt-3 text-right">
            {conflict.token_length} tokens
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const [contractA, setContractA] = useState("");
  const [contractB, setContractB] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<"clauses" | "conflicts">("clauses");

  // Add this helper at the top of the file, near your constants

  const conflictTypes = new Set(result?.conflicts.map((c) => c.clause_type) ?? []);

  const handleAnalyze = useCallback(async () => {
    if (!contractA.trim() || !contractB.trim()) {
      setError("Please paste both contracts before analyzing.");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      // UPDATED: Pointing to the correct two-contract comparison endpoint
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_a: contractA, contract_b: contractB }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Server error");
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
      setActiveTab("clauses");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [contractA, contractB]);

  const strongConflicts   = result?.conflicts.filter((c) => !c.uncertain && c.predicted_label === "contradiction") ?? [];
  const uncertainConflicts = result?.conflicts.filter((c) => c.uncertain) ?? [];

  return (
    <div
      style={{ background: bgDark, color: textLight, fontFamily: "'Inter', sans-serif" }}
      className="min-h-screen overflow-x-hidden selection:bg-[#C0B298] selection:text-[#1a1008]"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;600;700&display=swap');
        
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a1008; }
        ::-webkit-scrollbar-thumb { background: #C0B298; border-radius: 3px; }

        textarea {
          resize: none;
          scrollbar-width: thin;
          scrollbar-color: #C0B298 transparent;
        }
        textarea::placeholder { color: rgba(249,245,239,0.25); }

        @keyframes pulse-ring {
          0%   { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .pulse-ring { animation: pulse-ring 1.2s ease-out infinite; }

        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .shimmer {
          background: linear-gradient(90deg, #C0B298 0%, #f9f5ef 40%, #C0B298 60%, #C0B298 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2s linear infinite;
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 border-b border-white/5"
        style={{ background: "rgba(26,16,8,0.85)", backdropFilter: "blur(20px)" }}>
        <Link href="/" className="flex items-center gap-2">
          <Activity className="w-5 h-5" style={{ color: accent }} />
          <span className={`${clashFont} text-base`} style={{ color: textLight }}>
            CONTRACTPULSE
          </span>
        </Link>
        <span
          className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border"
          style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
        >
          Conflict Analyzer
        </span>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-10">

        {/* ── Header ── */}
        <div className="mb-10">
          <h1 className={`${clashFont} text-[clamp(2.5rem,5vw,5rem)] leading-[0.85] mb-4`}>
            CROSS-CONTRACT<br />
            <span className="shimmer">CONFLICT ENGINE</span>
          </h1>
          <p className="text-sm text-[#f9f5ef]/50 font-medium max-w-lg">
            Paste two contracts below. Our AI extracts every clause, pairs them by type, and flags contradictions before they become liability.
          </p>
        </div>

        {/* ── Dual Contract Input ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {[
            { label: "Contract A", value: contractA, set: setContractA, sample: SAMPLE_A },
            { label: "Contract B", value: contractB, set: setContractB, sample: SAMPLE_B },
          ].map(({ label, value, set, sample }, i) => (
            <div key={i}
              className="rounded-[28px] border overflow-hidden flex flex-col"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(20px)",
              }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-3 border-b"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <span className={`${clashFont} text-sm`} style={{ color: accent }}>
                  {label}
                </span>
                <div className="flex items-center gap-2">
                  {value && (
                    <button
                      onClick={() => set("")}
                      className="text-[#f9f5ef]/30 hover:text-[#f9f5ef]/60 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => set(sample)}
                    className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all hover:scale-105"
                    style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
                  >
                    Load Sample
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={`Paste ${label} here…`}
                rows={18}
                className="w-full bg-transparent px-5 py-4 text-sm font-medium leading-relaxed outline-none"
                style={{ color: textLight }}
              />

              {/* Word count */}
              <div className="px-5 py-2 border-t text-[10px] font-bold text-[#f9f5ef]/25"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {value.trim().split(/\s+/).filter(Boolean).length} words
              </div>
            </div>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-4 flex items-center gap-3 bg-red-500/10 border border-red-400/30 rounded-[16px] px-5 py-4">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300 font-medium">{error}</p>
          </div>
        )}

        {/* ── Analyze Button ── */}
        <div className="flex justify-center mb-12">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="relative flex items-center gap-3 px-12 py-5 rounded-full font-black text-sm uppercase tracking-widest transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_10px_40px_rgba(192,178,152,0.25)]"
            style={{ background: accent, color: bgDark }}
          >
            {loading ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="pulse-ring absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: bgDark }} />
                  <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: bgDark }} />
                </span>
                Analyzing Contracts…
              </>
            ) : (
              <>
                <Zap size={16} />
                Run Conflict Analysis
              </>
            )}
          </button>
        </div>

        {/* ── Results ── */}
        {result && (
          <div className="space-y-8">
            {/* Summary banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { val: result.clauses_a.length, label: "Clauses in A",     color: accent },
                { val: result.clauses_b.length, label: "Clauses in B",     color: accent },
                { val: strongConflicts.length,   label: "Hard Conflicts",   color: "#DC643C" },
                { val: uncertainConflicts.length, label: "Needs Review",   color: "#DCB428" },
              ].map((s, i) => (
                <div key={i}
                  className="rounded-[20px] p-5 text-center border"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <p className={`${clashFont} text-3xl mb-1`} style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#f9f5ef]/50">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tab switcher */}
            <div className="flex gap-2">
              {(["clauses", "conflicts"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all`}
                  style={activeTab === tab
                    ? { background: accent, color: bgDark }
                    : { background: "rgba(255,255,255,0.06)", color: `${textLight}60`, border: "1px solid rgba(255,255,255,0.08)" }
                  }
                >
                  {tab === "clauses" ? "Extracted Clauses" : `Conflicts (${result.conflicts.length})`}
                </button>
              ))}
            </div>

            {/* ── Clauses Tab ── */}
            {activeTab === "clauses" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(["A", "B"] as const).map((side) => {
                  const clauses = side === "A" ? result.clauses_a : result.clauses_b;
                  return (
                    <div key={side}
                      className="rounded-[28px] border p-5"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        borderColor: "rgba(255,255,255,0.08)",
                      }}
                    >
                      <h3 className={`${clashFont} text-base mb-4`} style={{ color: accent }}>
                        Contract {side} — {clauses.length} Clauses
                      </h3>
                      {clauses.map((clause, i) => (
                        <ClauseCard
                          key={i}
                          clause={clause}
                          hasConflict={conflictTypes.has(clause.clause_type)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Conflicts Tab ── */}
            {activeTab === "conflicts" && (
              <div className="space-y-6">
                {strongConflicts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <AlertTriangle size={16} className="text-red-400" />
                      <h3 className={`${clashFont} text-base text-red-400`}>
                        High-Confidence Conflicts
                      </h3>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-red-400/40 bg-red-400/10 text-red-400">
                        ≥ 75% certainty
                      </span>
                    </div>
                    {strongConflicts.map((c, i) => <ConflictRow key={i} conflict={c} idx={i} />)}
                  </div>
                )}

                {uncertainConflicts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <HelpCircle size={16} className="text-yellow-400" />
                      <h3 className={`${clashFont} text-base text-yellow-400`}>
                        Needs Human Review
                      </h3>
                    </div>
                    {uncertainConflicts.map((c, i) => <ConflictRow key={i} conflict={c} idx={i} />)}
                  </div>
                )}

                {result.conflicts.length === 0 && (
                  <div className="text-center py-16 rounded-[28px] border border-white/8"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    <CheckCircle size={32} className="text-green-400 mx-auto mb-4" />
                    <p className={`${clashFont} text-xl text-green-400 mb-2`}>No Conflicts Detected</p>
                    <p className="text-sm text-[#f9f5ef]/40">All matched clause types appear consistent.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}