"use client";
import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import { AlertTriangle, TrendingDown, Info, Activity, Clock, Crosshair, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import RiskForecastChart from "../components/RiskForecastChart";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const cls = {
  page: "min-h-screen bg-[#1a1008] text-[#f9f5ef] font-['Inter',sans-serif] selection:bg-[#C0B298] selection:text-[#1a1008] pb-24",
  clash: "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase",
  card: "bg-white/5 border border-white/10 rounded-[20px] shadow-lg overflow-hidden",
  cardHeader: "px-6 py-4 border-b border-white/5 flex items-center gap-2",
  label: "text-[10px] tracking-[0.2em] font-bold uppercase text-[#f9f5ef]/50",
};

interface ForecastData {
  ticker: string;
  available_tickers: string[];
  breach_detected: boolean;
  breach_date: string | null;
  days_to_breach: number | null;
  confidence_tier: string;
  risk_score: number;
  risk_pct_of_threshold: number;
  threshold: number;
  forecast_series: Array<{
    ds: string;
    y: number | null;
    yhat: number | null;
    yhat_lower: number | null;
    yhat_upper: number | null;
  }>;
  model_meta: {
  run_date: string;
  target_threshold: number;
  horizon_days?: number;
}
}

export default function ForecastDashboard() {
  const [activeTicker, setActiveTicker] = useState<string>("AAPL");
  const [availableTickers, setAvailableTickers] = useState<string[]>([]);
  const [data, setData]       = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchRisk = useCallback(async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/risk?ticker=${ticker}&horizon=30`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load forecast");
      setData(json);
      if (json.available_tickers?.length) setAvailableTickers(json.available_tickers);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load available tickers on mount
  useEffect(() => {
    fetch(`${BACKEND}/api/risk/tickers`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.tickers?.length) { setAvailableTickers(d.tickers); fetchRisk(d.tickers[0]); setActiveTicker(d.tickers[0]); }})
      .catch(() => fetchRisk("AAPL"));
  }, [fetchRisk]);

  const handleTickerChange = (t: string) => { setActiveTicker(t); fetchRisk(t); };

  return (
    <div className={cls.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');`}</style>
      <Navbar />

      <div className="pt-24 max-w-[1200px] mx-auto px-6">
        {/* Top Header & Ticker Selector */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 pt-8">
          <div>
            <p className={cls.label}>Model Run: {data?.model_meta?.run_date || "—"}</p>
            <h1 className={`${cls.clash} text-3xl mt-2 text-[#f9f5ef]`}>RISK FORECAST</h1>
          </div>
          {availableTickers.length > 0 && (
            <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-full border border-white/10">
              {availableTickers.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTickerChange(t)}
                  className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeTicker === t ? "bg-[#C0B298] text-[#1a1008] shadow-md" : "text-[#f9f5ef]/60 hover:text-[#f9f5ef]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center h-64 gap-3 text-[#f9f5ef]/50">
            <RefreshCw size={20} className="animate-spin text-[#C0B298]" />
            <span className="text-sm uppercase tracking-widest font-bold">Loading model…</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex items-center gap-3 text-red-400 text-sm mb-8">
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* A. Breach Alert Banner */}
            {data.breach_detected && (
              <div className="mb-8 w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={24} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className={`${cls.clash} text-red-500 text-lg`}>HIGH PROBABILITY BREACH ALERT</h3>
                    <p className="text-sm text-[#f9f5ef]/80 mt-1">
                      Model predicts crossover in <strong>{data.days_to_breach} days</strong> (Est: {data.breach_date}).
                    </p>
                  </div>
                </div>
                <div className="px-5 py-2.5 rounded-full bg-red-500/20 text-red-500 font-bold text-[10px] uppercase tracking-widest border border-red-500/30 shrink-0">
                  Confidence: {data.confidence_tier}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* B. Risk Gauge */}
              <div className={`${cls.card} flex flex-col justify-between`}>
                <div className={cls.cardHeader}>
                  <Activity size={16} className="text-[#C0B298]" />
                  <span className={cls.label}>Current Risk Extent</span>
                </div>
                <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                  <div className="relative mb-6">
                    <svg viewBox="0 0 100 50" className="w-48 drop-shadow-lg">
                      <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50" fill="none"
                        stroke={data.risk_score >= 100 ? "#ef4444" : data.risk_score > 70 ? "#f59e0b" : "#10b981"}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray="125.6"
                        strokeDashoffset={125.6 - (125.6 * Math.min(data.risk_score, 100)) / 100}
                        style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.5s ease-out" }}
                      />
                    </svg>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-[130%] flex flex-col items-center">
                      <span className={`${cls.clash} text-5xl ${data.risk_score >= 100 ? "text-red-500" : "text-[#f9f5ef]"}`}>{Math.round(data.risk_score)}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[#f9f5ef]/60">Risk Score vs Threshold ({Math.round(data.threshold)})</p>
                </div>
              </div>

              {/* D. 4-Signal Breakdown approximated from risk data */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                {[
                  { label: "Risk Score",       val: `${Math.round(data.risk_score)}%`,        icon: TrendingDown },
                  { label: "Threshold",        val: `${Math.round(data.threshold)}`,           icon: Activity },
                  { label: "Horizon (days)",   val: `${data.model_meta?.horizon_days ?? 30}`,  icon: Clock },
                  { label: "Confidence",       val: data.confidence_tier,                      icon: Crosshair },
                ].map((s, i) => (
                  <div key={i} className={`${cls.card} p-6 flex flex-col justify-between`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className={cls.label}>{s.label}</span>
                      <s.icon size={16} className="text-[#C0B298]/60" />
                    </div>
                    <p className={`${cls.clash} text-3xl`}>{s.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* C. Forecast Line Chart */}
            <RiskForecastChart riskData={data} />

            {/* E + F. Explanation + Info Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={cls.card}>
                <div className={cls.cardHeader}>
                  <Info size={16} className="text-[#C0B298]" />
                  <span className={cls.label}>Model Rationalization</span>
                </div>
                <div className="p-6">
                  <ul className="space-y-4">
                    {[
                      `Prophet forecast for ${activeTicker} with ${data.model_meta?.horizon_days ?? 30}-day horizon.`,
                      `Current risk score is ${Math.round(data.risk_score)} vs a threshold of ${Math.round(data.threshold)}.`,
                      data.breach_detected
                        ? `Breach is predicted in ${data.days_to_breach} days — confidence: ${data.confidence_tier}.`
                        : "No breach is predicted within the current forecast horizon.",
                    ].map((exp, idx) => (
                      <li key={idx} className="flex gap-3 text-sm text-[#f9f5ef]/80 leading-relaxed">
                        <span className="text-[#C0B298] mt-1 shrink-0 font-bold">✦</span> {exp}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className={cls.card}>
                <div className={cls.cardHeader}>
                  <TrendingDown size={16} className="text-[#C0B298]" />
                  <span className={cls.label}>Available Tickers</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="p-4 text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/40">Ticker</th>
                        <th className="p-4 text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/40">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {availableTickers.map((t) => (
                        <tr
                          key={t}
                          onClick={() => handleTickerChange(t)}
                          className={`cursor-pointer hover:bg-white/[0.03] transition-colors ${activeTicker === t ? "bg-white/5" : ""}`}
                        >
                          <td className={`p-4 text-sm font-bold ${activeTicker === t ? "text-[#C0B298]" : ""}`}>{t}</td>
                          <td className="p-4">
                            <span className={`inline-block w-2 h-2 rounded-full ${activeTicker === t ? "bg-[#C0B298]" : "bg-white/20"}`}></span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
