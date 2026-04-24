"use client";
import { Calendar } from "lucide-react";
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
  ReferenceDot
} from "recharts";

// Assuming 'riskData' is the JSON object returned from your Flask /api/risk endpoint
export default function RiskForecastChart({ riskData }: { riskData: any }) {
  if (!riskData || !riskData.forecast_series) {
    return (
      <div className="h-80 w-full flex items-center justify-center border border-white/10 rounded-2xl bg-white/5">
        <p className="text-[#f9f5ef]/50 text-sm animate-pulse">Loading forecast data...</p>
      </div>
    );
  }

  const generateCalendarLink = () => {
    if (!riskData.breach_date) return "#";
    const dateStr = riskData.breach_date.replace(/-/g, '');
    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.append("action", "TEMPLATE");
    url.searchParams.append("text", `[URGENT] Covenant Breach: ${riskData.ticker}`);
    url.searchParams.append("dates", `${dateStr}T090000Z/${dateStr}T100000Z`);
    url.searchParams.append("details", `A predicted covenant breach for ${riskData.ticker} is expected on this date.\n\nThreshold: ${riskData.threshold}%\nPlease review the ContractPulse dashboard immediately.`);
    return url.toString();
  };

  return (
    <div className="h-[500px] w-full bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h3 className="font-['Space_Grotesk',sans-serif] font-bold text-lg text-[#f9f5ef]">
            {riskData.ticker} Breach Forecast
          </h3>
          <p className="text-xs text-[#f9f5ef]/50 uppercase tracking-widest">
            Prophet Time-Series Projection
          </p>
        </div>
        
        {riskData.forecast?.breach_predicted && riskData.breach_date && (
          <a 
            href={generateCalendarLink()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(240,136,62,0.15)",
              border: "1px solid rgba(240,136,62,0.4)",
              color: "#f0883e",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              transition: "all 0.2s"
            }}
          >
            <Calendar size={14} /> Add Reminder
          </a>
        )}
      </div>

      <ResponsiveContainer width="100%" height="80%">
        <ComposedChart data={riskData.forecast_series} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.1} vertical={false} />
          
          <XAxis 
            dataKey="ds" 
            stroke="#f9f5ef" 
            strokeOpacity={0.4} 
            tick={{ fill: '#f9f5ef', opacity: 0.5, fontSize: 12 }} 
            tickFormatter={(val) => {
              // Formats 'YYYY-MM-DD' to 'MMM DD'
              const date = new Date(val);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          
          <YAxis 
            domain={[0, 100]} 
            stroke="#f9f5ef" 
            strokeOpacity={0.4} 
            tick={{ fill: '#f9f5ef', opacity: 0.5, fontSize: 12 }}
            tickFormatter={(val) => `${val}%`}
          />
          
          <Tooltip 
            contentStyle={{ backgroundColor: '#1a1008', borderColor: '#C0B298', borderRadius: '8px' }}
            itemStyle={{ color: '#f9f5ef' }}
            labelStyle={{ color: '#C0B298', fontWeight: 'bold', marginBottom: '8px' }}
          />

          {/* 1. The Danger Threshold Line */}
          <ReferenceLine 
            y={riskData.threshold} 
            stroke="#ff4d4d" 
            strokeDasharray="5 5" 
            strokeWidth={2}
            label={{ position: 'top', value: `Covenant Breach Threshold (${riskData.threshold}%)`, fill: '#ff4d4d', fontSize: 12 }} 
          />

          {/* 2. Confidence Interval (Upper/Lower bounds) */}
          <Area 
            type="monotone" 
            dataKey="yhat_range" 
            stroke="none" 
            fill="#f0883e" 
            fillOpacity={0.2} 
            name="Forecast Confidence Interval"
            connectNulls={true}
          />

          {/* 3. The Predicted Forecast Line (yhat) */}
          <Line 
            type="monotone" 
            dataKey="yhat" 
            stroke="#f0883e" 
            strokeWidth={2.5} 
            dot={false} 
            name="AI Forecast (90 Days)" 
            connectNulls={true}
          />

          {/* 4. The Actual Historical Data (y) */}
          <Line 
            type="monotone" 
            dataKey="y" 
            stroke="#58a6ff" 
            strokeWidth={1.5} 
            dot={false} 
            name="Historical Risk Score" 
            connectNulls={true} 
          />

          {/* 5. Predicted Breach Event Dot */}
          {riskData.forecast?.breach_predicted && riskData.breach_date && (
            <ReferenceDot 
              x={riskData.breach_date} 
              y={riskData.threshold} 
              r={6} 
              fill="#ff4d4d" 
              stroke="#ffffff" 
              strokeWidth={2} 
            />
          )}

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}