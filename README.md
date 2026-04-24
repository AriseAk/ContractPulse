# ContractPulse: Covenant Intelligence & Risk Forecasting

ContractPulse is a premium Fintech SaaS platform designed to transform static legal contracts into dynamic, predictive monitoring engines. It bridges the gap between legal departments and financial risk management by using state-of-the-art AI to parse obligations, detect cross-document conflicts, and forecast breach risks in real-time.

---

## 🚀 Key Modules

### 1. Covenant Intelligence (Demo)
Automatically parses complex PDFs using fine-tuned **RoBERTa (Extractive QA)** to identify financial covenants, reporting timelines, and restrictions.
- **Side-by-Side Viewer**: Interactive dual-pane interface with synchronized highlighting between legal text and AI-extracted data.
- **Scenario Simulator**: "What-If" playground allowing real-time adjustment of revenue, cost, and interest rate parameters to see immediate impact on risk scores.

### 2. Conflict Detection (Compare)
Uses **Natural Language Inference (NLI)** and **Groq-powered LLMs** to compare multiple agreements.
- **Cross-Contract Analysis**: Detects contradictions, overlaps, or discrepancies between a Master Services Agreement and a specific Vendor Order.
- **Semantic Mapping**: Pairs clauses of the same type (e.g., Termination, Indemnification) across documents before conflict scoring.

### 3. Risk Forecasting (Forecast)
A predictive engine powered by **Facebook Prophet** that analyzes historical financial data to project the "Time-to-Breach" for specific covenants.
- **Prophet Time-Series**: Projects future financial health based on per-ticker historical stock and revenue data.
- **Danger Zone Alerts**: Visualizes threshold crossings and provides confidence tiers (High/Medium/Low) for predicted breaches.

### 4. Response Engine (Scheduler)
An automated orchestration layer that handles detected or predicted breaches.
- **Auto-Tasking**: Assigns mitigation tasks to relevant departments (Legal, Finance, Executive) based on breach severity.
- **Smart Booking**: Automatically schedules conflict resolution meetings in the "Boardroom" or "Conference rooms" when critical contradictions are detected.

---

## 🛠 Technology Stack

### Backend (Flask + ML)
- **Language**: Python 3.11+
- **Inference**: **Groq API** for high-speed clause extraction and classification.
- **Models**:
    - `ckpt_obligation_fast`: RoBERTa-based QA for strict numerical covenant extraction.
    - `model_3`: DistilBERT for Cross-Clause NLI (Entailment/Contradiction/Neutral).
    - `Prophet`: Time-series forecasting for breach probability.
- **Database**: MongoDB Atlas.
- **Auth**: Secure Google OAuth 2.0 integration.

### Frontend (Next.js 14)
- **Framework**: Next.js (App Router) with TypeScript.
- **Styling**: Tailwind CSS with a "Liquid Dark" premium fintech aesthetic.
- **Charts**: `recharts` for high-performance risk visualization.
- **State Management**: React Hooks & Context for real-time scenario simulation.

---

## 📂 Project Structure

```text
ContractPulse/
├── backend/
│   ├── main.py                # Main Flask API & Model Registry
│   ├── clause_extractor.py    # Groq-powered Clause Extraction & NLI Pairing
│   ├── scheduler_api.py       # Breach Response Engine & Meeting Scheduler
│   ├── ckpt_obligation_fast/   # RoBERTa QA Model weights
│   ├── model_3/                # NLI Model weights
│   └── .env                   # Backend secrets (GROQ, Mongo, Google)
├── frontend/
│   ├── app/
│   │   ├── demo/              # Contract Analysis Playground
│   │   ├── compare/           # Two-Contract Comparison Dashboard
│   │   ├── forecast/          # Risk Dashboard (Prophet Charts)
│   │   └── report/            # Dynamic AI Risk Reports
│   └── .env.local             # API endpoints
└── data/
    └── Stocks/                # CSVs for historical ticker data
```

---

## 🏁 Getting Started

### 1. Backend Setup
```bash
cd backend
pip install -r ../requirements.txt
# Set GROQ_API_KEY, MONGO_URI, and GOOGLE_CLIENT_ID in .env
python main.py
```
*API Port: `http://localhost:5000`*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*App URL: `http://localhost:3000`*

---

## 🧠 The AI Pipeline

1. **Ingestion**: PDFs are parsed and cleaned into plain text.
2. **Extraction**: Groq extracts high-level legal clauses, while RoBERTa extracts strict numerical covenants.
3. **Forecasting**: Prophet runs per-ticker simulations against current obligations to predict future breaches.
4. **Conflict Scoring**: Model 3 (NLI) scores paired clauses as **Contradiction**, **Entailment**, or **Neutral**.
5. **Mitigation**: If risk > threshold, the Response Engine triggers email alerts and schedules mitigation tasks.
