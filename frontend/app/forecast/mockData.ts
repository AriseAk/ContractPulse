export interface ForecastPoint {
  ds: string;
  y: number | null;
  yhat: number | null;
  yhat_lower: number | null;
  yhat_upper: number | null;
}

export interface CrisisScenario {
  scenario: string;
  date_window: string;
  threshold: number;
  breach_predicted: boolean;
  mae: number;
  rmse: number;
}

export interface TickerData {
  name: string;
  breach_detected: boolean;
  days_to_breach: number | null;
  breach_date: string | null;
  confidence_tier: string;
  risk_pct_of_threshold: number;
  risk_score: number;
  forecast_series: ForecastPoint[];
  sub_signals: {
    drawdown_pct_below_ath: number;
    vol_14: number;
    vol_vs_median_pct: number;
    momentum: number;
    returns_5d_pct: number;
  };
  explanation: string[];
  crisis_scenarios: CrisisScenario[];
}

export const payload = {
  model_meta: {
    run_date: "2026-04-24",
    target_threshold: 100
  },
  tickers: ["SBI_TERM_FACILITY", "HDFC_WORKING_CAP", "INFRA_BANK_ICR"],
  data: {
    "SBI_TERM_FACILITY": {
      name: "SBI Term Loan - Debt/EBITDA",
      breach_detected: true,
      days_to_breach: 14,
      breach_date: "2026-05-08",
      confidence_tier: "High",
      risk_pct_of_threshold: 92,
      risk_score: 92,
      forecast_series: Array.from({ length: 60 }).map((_, i) => {
        const d = new Date(2026, 2, 24 + i);
        const dateStr = d.toISOString().split("T")[0];
        
        // Past 30 days
        if (i < 30) {
          const base = 40 + (i * 1.5);
          return {
            ds: dateStr,
            y: base + (Math.random() * 5 - 2.5),
            yhat: null,
            yhat_lower: null,
            yhat_upper: null
          };
        } 
        // Future forecast
        else {
          const base = 85 + ((i - 30) * 1.2);
          return {
            ds: dateStr,
            y: null,
            yhat: base,
            yhat_lower: base - 5,
            yhat_upper: base + 8
          };
        }
      }),
      sub_signals: {
        drawdown_pct_below_ath: 12.4,
        vol_14: 4.2,
        vol_vs_median_pct: 125,
        momentum: -3.8,
        returns_5d_pct: -2.1
      },
      explanation: [
        "EBITDA margins remain compressed following recent input material cost spikes.",
        "Drawdown is accelerating beyond historical 90th percentile bounds.",
        "Model predicts target threshold crossover within 14 days, highly sensitive to upcoming Q2 payments."
      ],
      crisis_scenarios: [
        { scenario: "Rate Hike Shock 23", date_window: "Q3 2023", threshold: 100, breach_predicted: true, mae: 4.1, rmse: 5.6 },
        { scenario: "Supply Chain Outage", date_window: "Q1 2024", threshold: 100, breach_predicted: true, mae: 2.8, rmse: 3.1 }
      ]
    },
    "HDFC_WORKING_CAP": {
      name: "HDFC WC - Minimum Cash",
      breach_detected: false,
      days_to_breach: null,
      breach_date: null,
      confidence_tier: "Medium",
      risk_pct_of_threshold: 24,
      risk_score: 24,
      forecast_series: Array.from({ length: 60 }).map((_, i) => {
        const d = new Date(2026, 2, 24 + i);
        const dateStr = d.toISOString().split("T")[0];
        if (i < 30) {
          return { ds: dateStr, y: 20 + Math.random() * 8, yhat: null, yhat_lower: null, yhat_upper: null };
        } else {
          return { ds: dateStr, y: null, yhat: 24, yhat_lower: 15, yhat_upper: 35 };
        }
      }),
      sub_signals: {
        drawdown_pct_below_ath: 2.1,
        vol_14: 1.2,
        vol_vs_median_pct: 95,
        momentum: 1.4,
        returns_5d_pct: 0.8
      },
      explanation: [
        "Cash balances are stable and aligned with historical seasonal cycles.",
        "No immediate liquidity stress detected. Upcoming tax outflows are fully provisioned."
      ],
      crisis_scenarios: [
        { scenario: "Demand Drop Pandemic", date_window: "Q2 2020", threshold: 100, breach_predicted: false, mae: 5.2, rmse: 7.1 }
      ]
    },
    "INFRA_BANK_ICR": {
      name: "Infra Bank - ICR",
      breach_detected: true,
      days_to_breach: 5,
      breach_date: "2026-04-29",
      confidence_tier: "Very High",
      risk_pct_of_threshold: 98,
      risk_score: 98,
      forecast_series: Array.from({ length: 60 }).map((_, i) => {
        const d = new Date(2026, 2, 24 + i);
        const dateStr = d.toISOString().split("T")[0];
        if (i < 30) {
          return { ds: dateStr, y: 90 + (i * 0.3), yhat: null, yhat_lower: null, yhat_upper: null };
        } else {
          const base = 98 + ((i - 30) * 1.5);
          return { ds: dateStr, y: null, yhat: base, yhat_lower: base - 2, yhat_upper: base + 4 };
        }
      }),
      sub_signals: {
        drawdown_pct_below_ath: 8.9,
        vol_14: 6.8,
        vol_vs_median_pct: 180,
        momentum: -5.4,
        returns_5d_pct: -4.3
      },
      explanation: [
        "Interest coverage ratio has deteriorated critically due to new high-cost facility drawdowns.",
        "Model confidence is extremely high due to low volatility in the downward trend trajectory.",
        "Breach is practically guaranteed before end-of-month."
      ],
      crisis_scenarios: [
        { scenario: "Credit Squeeze", date_window: "Q4 2018", threshold: 100, breach_predicted: true, mae: 1.8, rmse: 2.2 }
      ]
    }
  }
} as Record<string, any>;
