"use client";
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine 
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

  return (
    <div className="h-[400px] w-full bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="mb-6">
        <h3 className="font-['Space_Grotesk',sans-serif] font-bold text-lg text-[#f9f5ef]">
          {riskData.ticker} Breach Forecast
        </h3>
        <p className="text-xs text-[#f9f5ef]/50 uppercase tracking-widest">
          Prophet Time-Series Projection
        </p>
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
            stroke="#ef4444" 
            strokeDasharray="4 4" 
            label={{ position: 'top', value: 'Breach Limit', fill: '#ef4444', fontSize: 12 }} 
          />

          {/* 2. Confidence Interval (Upper/Lower bounds) */}
          {/* We use an Area to represent the space between yhat_lower and yhat_upper */}
          <Area 
            type="monotone" 
            dataKey="yhat_upper" 
            stroke="none" 
            fill="#C0B298" 
            fillOpacity={0.1} 
          />

          {/* 3. The Predicted Forecast Line (yhat) */}
          <Line 
            type="monotone" 
            dataKey="yhat" 
            stroke="#C0B298" 
            strokeWidth={2} 
            strokeDasharray="5 5" 
            dot={false} 
            name="Forecasted Risk" 
          />

          {/* 4. The Actual Historical Data (y) */}
          <Line 
            type="monotone" 
            dataKey="y" 
            stroke="#10b981" 
            strokeWidth={2} 
            dot={false} 
            name="Historical Risk" 
            connectNulls={true} 
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}