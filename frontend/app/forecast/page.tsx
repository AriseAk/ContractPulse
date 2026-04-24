"use client";
import React, { useState } from "react";
import Navbar from "../components/Navbar";
import { payload, TickerData } from "./mockData";
import { AlertTriangle, TrendingDown, Info, Activity, Clock, Crosshair } from "lucide-react";
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

const cls = {
  page: "min-h-screen bg-[#1a1008] text-[#f9f5ef] font-['Inter',sans-serif] selection:bg-[#C0B298] selection:text-[#1a1008] pb-24",
  clash: "font-['Space_Grotesk',sans-serif] font-bold tracking-tighter uppercase",
  card: "bg-white/5 border border-white/10 rounded-[20px] shadow-lg overflow-hidden",
  cardHeader: "px-6 py-4 border-b border-white/5 flex items-center gap-2",
  label: "text-[10px] tracking-[0.2em] font-bold uppercase text-[#f9f5ef]/50",
};

export default function ForecastDashboard() {
  const [activeTicker, setActiveTicker] = useState<string>(payload.tickers[0]);
  const tickerData: TickerData = payload.data[activeTicker];

  // Map graph data to ensure continuity between history (y) and forecast (yhat)
  let lastHistoricalPoint: any = null;
  const graphData = tickerData.forecast_series.map((pt) => {
    // We bind historical to forecast visually if this is the start of the forecast
    if (pt.y !== null) lastHistoricalPoint = pt;
    if (pt.y === null && pt.yhat !== null && lastHistoricalPoint) {
      if (lastHistoricalPoint._patched) return pt; 
      lastHistoricalPoint._patched = true;
      lastHistoricalPoint.yhat = lastHistoricalPoint.y;
      lastHistoricalPoint.yhat_lower = lastHistoricalPoint.y;
      lastHistoricalPoint.yhat_upper = lastHistoricalPoint.y;
    }
    return pt;
  });

  return (
    <div className={cls.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700;900&family=Inter:wght@400;500;700&display=swap');`}</style>
      <Navbar />

      <div className="pt-24 max-w-[1200px] mx-auto px-6">
        
        {/* Top Header & Ticker Selector */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 pt-8">
          <div>
            <p className={cls.label}>Model Run: {payload.model_meta.run_date}</p>
            <h1 className={`${cls.clash} text-3xl mt-2 text-[#f9f5ef]`}>RISK FORECAST</h1>
          </div>
          
          <div className="flex gap-2 p-1 bg-white/5 rounded-full border border-white/10">
            {payload.tickers.map((t: string) => (
              <button
                key={t}
                onClick={() => setActiveTicker(t)}
                className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                  activeTicker === t
                    ? "bg-[#C0B298] text-[#1a1008] shadow-md"
                    : "text-[#f9f5ef]/60 hover:text-[#f9f5ef]"
                }`}
              >
                {t.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* A. Breach Alert Banner */}
        {tickerData.breach_detected && (
          <div className="mb-8 w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className={`${cls.clash} text-red-500 text-lg`}>HIGH PROBABILITY BREACH ALERT</h3>
                <p className="text-sm text-[#f9f5ef]/80 mt-1">
                  Model predicts crossover in <strong>{tickerData.days_to_breach} days</strong> (Est: {tickerData.breach_date}).
                </p>
              </div>
            </div>
            <div className="px-5 py-2.5 rounded-full bg-red-500/20 text-red-500 font-bold text-[10px] uppercase tracking-widest border border-red-500/30 shrink-0">
              Confidence: {tickerData.confidence_tier}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* B. Risk Gauge / Hero Metric */}
          <div className={`${cls.card} flex flex-col justify-between`}>
            <div className={cls.cardHeader}>
              <Activity size={16} className="text-[#C0B298]" />
              <span className={cls.label}>Current Risk Extent</span>
            </div>
            <div className="p-8 flex flex-col items-center justify-center h-full text-center">
              <div className="relative mb-6">
                <svg viewBox="0 0 100 50" className="w-48 drop-shadow-lg">
                  {/* Background Track */}
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
                  {/* Risk Arc */}
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50" fill="none"
                    stroke={tickerData.risk_pct_of_threshold >= 100 ? "#ef4444" : tickerData.risk_pct_of_threshold > 70 ? "#f59e0b" : "#10b981"}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray="125.6"
                    strokeDashoffset={125.6 - (125.6 * Math.min(tickerData.risk_pct_of_threshold, 100)) / 100}
                    style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.5s ease-out" }}
                  />
                </svg>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-[130%] flex flex-col items-center">
                  <span className={`${cls.clash} text-5xl ${tickerData.risk_score >= 100 ? "text-red-500" : "text-[#f9f5ef]"}`}>{Math.round(tickerData.risk_score)}</span>
                </div>
              </div>
              <p className="text-sm font-medium text-[#f9f5ef]/60">Risk Score vs Threshold</p>
            </div>
          </div>

          {/* D. 4-Signal Breakdown Cards */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {[
              { label: "Drawdown vs ATH", val: `${tickerData.sub_signals.drawdown_pct_below_ath.toFixed(1)}%`, icon: TrendingDown },
              { label: "14-Day Volatility", val: tickerData.sub_signals.vol_14.toFixed(2), icon: Activity },
              { label: "Vol vs Median Bounds", val: `${tickerData.sub_signals.vol_vs_median_pct}%`, icon: Crosshair },
              { label: "Momentum", val: tickerData.sub_signals.momentum.toFixed(1), icon: Clock },
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

        {/* C. The Forecast Line Chart */}
        <div className={`${cls.card} mb-8`}>
          <div className={cls.cardHeader}>
            <TrendingDown size={16} className="text-[#C0B298]" />
            <span className={cls.label}>Risk Forecast Trajectory</span>
          </div>
          <div className="p-6 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={graphData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorYhat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C0B298" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#C0B298" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="ds" 
                  tickFormatter={(val) => {
                    const date = new Date(val);
                    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }}
                  stroke="#555" 
                  tick={{ fontSize: 11, fill: "#cfcfcf", opacity: 0.5 }} 
                  axisLine={false} 
                  tickLine={false}
                  minTickGap={30}
                />
                <YAxis 
                  domain={[0, Math.max(120, tickerData.risk_score + 20)]}
                  stroke="#555" 
                  tick={{ fontSize: 11, fill: "#cfcfcf", opacity: 0.5 }} 
                  axisLine={false} 
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1a1008", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
                  itemStyle={{ color: "#f9f5ef", fontSize: "14px", fontWeight: "bold" }}
                  labelStyle={{ color: "rgba(249, 245, 239, 0.5)", fontSize: "12px", marginBottom: "4px" }}
                />
                
                <ReferenceLine 
                  y={payload.model_meta.target_threshold} 
                  stroke="#ef4444" 
                  strokeDasharray="4 4" 
                  label={{ position: "insideTopLeft", value: "BREACH THRESHOLD", fill: "#ef4444", fontSize: 10, offset: 10, fontWeight: "bold", opacity: 0.8 }} 
                />

                {tickerData.breach_date && (
                  <ReferenceLine 
                    x={tickerData.breach_date} 
                    stroke="#ef4444" 
                    strokeOpacity={0.3}
                  />
                )}

                {/* Confidence Band Area */}
                <Area 
                  type="monotone" 
                  dataKey="yhat_upper" 
                  stroke="none" 
                  fill="#C0B298" 
                  fillOpacity={0.05} 
                  isAnimationActive={false}
                />
                <Area 
                  type="monotone" 
                  dataKey="yhat_lower" 
                  stroke="none" 
                  fill="#1a1008" 
                  fillOpacity={1} 
                  isAnimationActive={false}
                />

                {/* Main Forecast Line */}
                <Line 
                  type="monotone" 
                  dataKey="yhat" 
                  stroke="#C0B298" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={false} 
                  activeDot={{ r: 6, fill: "#1a1008", stroke: "#C0B298", strokeWidth: 2 }}
                />

                {/* Historical Line */}
                <Line 
                  type="monotone" 
                  dataKey="y" 
                  stroke="#f9f5ef" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 6, fill: "#1a1008", stroke: "#f9f5ef", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* E. AI Explanation Panel */}
          <div className={cls.card}>
            <div className={cls.cardHeader}>
              <Info size={16} className="text-[#C0B298]" />
              <span className={cls.label}>Model Rationalization</span>
            </div>
            <div className="p-6">
              <ul className="space-y-4">
                {tickerData.explanation.map((exp, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-[#f9f5ef]/80 leading-relaxed">
                    <span className="text-[#C0B298] mt-1 shrink-0 font-bold">✦</span> {exp}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* F. Crisis Scenarios / Backtest Table */}
          <div className={cls.card}>
            <div className={cls.cardHeader}>
              <TrendingDown size={16} className="text-[#C0B298]" />
              <span className={cls.label}>Crisis Scenario Backvalidation</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="p-4 text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/40">Scenario</th>
                    <th className="p-4 text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/40">Window</th>
                    <th className="p-4 text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/40">Acc (MAE)</th>
                    <th className="p-4 text-[10px] font-bold tracking-widest uppercase text-[#f9f5ef]/40">Breach</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tickerData.crisis_scenarios.map((cs, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-sm font-medium">{cs.scenario}</td>
                    <td className="p-4 text-xs text-[#f9f5ef]/50">{cs.date_window}</td>
                    <td className="p-4 text-xs text-[#f9f5ef]/80">{cs.mae.toFixed(2)}</td>
                    <td className="p-4">
                      {cs.breach_predicted ? (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                      ) : (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      )}
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
