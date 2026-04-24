# ContractPulse: Covenant Intelligence System

ContractPulse is a high-end Fintech SaaS platform designed to transform static legal contracts into dynamic, predictive monitoring engines. It bridges the gap between legal departments and financial risk management by using state-of-the-art AI to parse obligations and forecast breach risks in real-time.

## 🚀 Key Features

*   **Obligation Extraction**: Automatically parses complex PDFs using fine-tuned **DistilBERT (Extractive QA)** to identify financial covenants, reporting timelines, and restrictions.
*   **Conflict Detection**: Uses **NLI (Natural Language Inference)** to detect contradictions between different contract clauses or overlapping agreements.
*   **Risk Forecasting**: A predictive engine powered by **Facebook Prophet** that takes historical financial data and projects the "Time-to-Breach" for specific covenants.
*   **Scenario Simulator**: A "What-If" playground that allows users to adjust interest rates, revenue, and costs to see immediate impacts on contract risk scores.
*   **Dynamic Reporting**: Generates editorial-grade, exportable PDF reports based on live AI analysis.

---

## 🛠 Technology Stack

### Backend (Flask + ML)
- **Language**: Python 3.11+
- **Models**:
    - `ckpt_obligation_fast`: RoBERTa-based Question Answering for clause extraction.
    - `model_3`: DistilBERT for Cross-Clause NLI (Entailment/Contradiction).
    - `risk_model_v10_extended.pkl`: A library of per-ticker Prophet models for time-series forecasting.
- **Database**: MongoDB Atlas (with `certifi` for secure Windows execution).
- **Auth**: Secure Google OAuth integration.

### Frontend (Next.js 14)
- **Framework**: Next.js (App Router).
- **Styling**: Tailwind CSS with a "Liquid Dark" premium fintech aesthetic.
- **Charts**: `recharts` for high-performance time-series visualization.
- **Icons**: `lucide-react`.

---

## 📂 Project Structure

```text
ContractPulse/
├── backend/
│   ├── main.py                    # Main Flask API & Model Registry
│   ├── risk_model_v10_extended.pkl # Serialized Prophet Models
│   ├── ckpt_obligation_fast/       # RoBERTa QA Model weights
│   ├── model_3/                    # NLI Model weights
│   └── .env                       # Backend secrets (Mongo/Google Auth)
├── frontend/
│   ├── app/
│   │   ├── demo/                  # Contract Playground
│   │   ├── forecast/              # Risk Dashboard (Charts)
│   │   ├── report/                # Dynamic AI Reports
│   │   └── landingpage/           # Premium Brand Home
│   └── .env.local                 # API endpoints
└── data/
    └── Stocks/                    # CSVs for historical ticker data
```

---

## 🏁 Getting Started

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
# Requires: flask, transformers, torch, prophet, pdfplumber, pymongo, certifi
python main.py
```
*Port: `http://localhost:5000`*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Port: `http://localhost:3000`*

---

## 🧠 Business Logic
1. **Extraction**: The system runs 8 specific "Covenant Questions" against uploaded text via the QA model.
2. **Normalization**: Risk scores from Prophet and QA confidence are normalized to a 0–100 scale.
3. **Breach Logic**: Breach is detected when the predicted `yhat` (forecast) crosses the calculated `threshold` for a specific entity/ticker.
