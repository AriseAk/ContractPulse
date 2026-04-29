# ContractPulse — Covenant Intelligence & Risk Forecasting

> **Transform static legal contracts into dynamic, predictive monitoring engines.**

ContractPulse is a full-stack Fintech SaaS platform that bridges legal departments and financial risk management using state-of-the-art AI. It parses obligations, detects cross-document conflicts, and forecasts covenant breach risk in real time.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [AI Pipeline](#ai-pipeline)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Model Details](#model-details)
  - [Model 1 — Obligation Extraction (RoBERTa QA)](#model-1--obligation-extraction-roberta-qa)
  - [Model 2 — Risk Forecasting (Prophet)](#model-2--risk-forecasting-prophet)
  - [Model 3 — Conflict Detection (NLI DistilBERT)](#model-3--conflict-detection-nli-distilbert)
- [Frontend Pages](#frontend-pages)
- [Training the Models](#training-the-models)
- [Docker Deployment](#docker-deployment)

---

## Overview

Financial contracts contain covenants — minimum cash balances, revenue thresholds, debt ratios, insurance requirements — that must be monitored continuously. ContractPulse automates this entirely:

1. **Upload** a contract PDF or paste text
2. **Extract** every financial obligation with AI confidence scores
3. **Monitor** breach proximity scores against live financial data
4. **Forecast** time-to-breach using Prophet time-series models
5. **Alert** stakeholders and auto-schedule mitigation meetings

---

### Drive - https://drive.google.com/drive/folders/1FsXf-XGfqwRe1cFepgBP9NnJRbSOfnav?usp=drive_link

---

## Key Features

| Module | Description |
|---|---|
| **Covenant Intelligence** | Fine-tuned RoBERTa QA extracts financial covenants, reporting timelines, and restrictions from PDFs |
| **Side-by-Side Viewer** | Dual-pane interface with synchronized highlighting between legal text and AI-extracted data |
| **Scenario Simulator** | "What-If" playground — adjust revenue, cost, and interest rate to see impact on risk scores |
| **Conflict Detection** | NLI + Groq-powered LLMs compare multiple agreements for contradictions and discrepancies |
| **Semantic Clause Pairing** | Pairs clauses of the same type across documents before conflict scoring |
| **Risk Forecasting** | Facebook Prophet projects "Time-to-Breach" for specific covenants using historical data |
| **Danger Zone Alerts** | Visualizes threshold crossings with High / Medium / Low confidence tiers |
| **Response Engine** | Auto-assigns mitigation tasks to Legal, Finance, and Executive teams on breach detection |
| **Smart Booking** | Automatically schedules conflict resolution meetings when critical contradictions are detected |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                     │
│  Landing · Demo · Compare · Forecast · Dashboard · etc.  │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                   Flask Backend (port 5000)              │
│                                                          │
│  /api/analyze   → Model 1 (RoBERTa QA pipeline)         │
│  /api/compare   → Groq extraction + Model 3 (NLI)       │
│  /api/risk      → Model 2 (Prophet forecasting)         │
│  /api/process_breach → Scheduler & auto-meeting         │
│  /auth/*        → Google OAuth 2.0 + email/password     │
└──────┬───────────────┬──────────────────┬───────────────┘
       │               │                  │
┌──────▼──────┐ ┌──────▼──────┐ ┌────────▼──────┐
│  Model 1    │ │  Model 3    │ │  Model 2      │
│  RoBERTa QA │ │  DistilBERT │ │  Prophet      │
│  (ckpt_obl) │ │  NLI        │ │  + sklearn    │
└─────────────┘ └─────────────┘ └───────────────┘
                         │
              ┌──────────▼──────────┐
              │   MongoDB Atlas     │
              │   (User accounts,   │
              │    session data)    │
              └─────────────────────┘
```

---

## Project Structure

```
ContractPulse/
│
├── README.md
├── requirements.txt                  # Python backend dependencies
│
├── all_model_code/                   # Model training & research code
│   ├── model_1_code/                 # RoBERTa QA obligation extraction
│   │   ├── pipeline.py               # Orchestrates all 7 stages end-to-end
│   │   ├── stage1_ingestion.py       # PDF / raw text ingestion
│   │   ├── stage2_cleaning.py        # Text normalization & cleaning
│   │   ├── stage3_segmentation.py    # Paragraph-level chunking
│   │   ├── stage4_qa_detection.py    # QA model inference per chunk
│   │   ├── stage5_span_filter.py     # Confidence + keyword filtering
│   │   ├── stage6_extraction.py      # Rules + spaCy NER extraction
│   │   ├── stage7_normalize.py       # Normalization & validation
│   │   ├── train_qa.py               # Full CUAD fine-tuning script
│   │   ├── train_qa_fast.py          # Speed-optimized training (hackathon)
│   │   ├── evaluate.py               # Evaluation metrics
│   │   └── utils.py                  # Device detection, RAM helpers
│   │
│   └── model_2_code/                 # Prophet risk forecasting
│       ├── inference_demo.py         # Standalone inference script
│       └── frontend_mock_api.json    # Mock API response for 14 tickers
│
├── backend/                          # Flask API server
│   ├── main.py                       # Main Flask app, routes, model registry
│   ├── clause_extractor.py           # Groq + Model 3 cross-contract pipeline
│   ├── scheduler_api.py              # Breach response engine & meeting scheduler
│   ├── model3.py                     # NLI model helpers
│   ├── Dockerfile                    # Container definition
│   ├── .env                          # Secrets (not committed)
│   ├── ckpt_obligation_fast/         # Fine-tuned RoBERTa QA weights
│   ├── model_2/                      # Prophet model artifacts
│   │   ├── inference_demo.py
│   │   └── frontend_mock_api.json
│   ├── model_3/                      # NLI DistilBERT weights
│   │   ├── config.json
│   │   ├── model.safetensors
│   │   ├── tokenizer.json
│   │   └── tokenizer_config.json
│   ├── data/Stocks/                  # Historical ticker CSVs for Prophet
│   ├── risk_model_v10_extended.pkl   # Serialized Prophet model bundle
│   └── session_data/                 # Flask session files
│
├── frontend/                         # Next.js 16 application
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── app/
│       ├── layout.tsx                # Root layout with Geist fonts
│       ├── page.tsx                  # Entry → redirects to landing page
│       ├── globals.css               # Tailwind + CSS variables
│       ├── components/
│       │   ├── Navbar.tsx            # Sticky nav with auth state
│       │   └── RiskForecastChart.tsx # Recharts Prophet visualization
│       ├── landingpage/page.tsx      # Marketing home page
│       ├── demo/page.tsx             # Contract analysis playground
│       ├── compare/page.tsx          # Two-contract conflict engine
│       ├── forecast/page.tsx         # Prophet risk dashboard
│       ├── dashboard/page.tsx        # Portfolio overview
│       ├── report/page.tsx           # AI-generated risk report
│       ├── scheduler/page.tsx        # Breach response & task board
│       ├── product/page.tsx          # Product feature breakdown
│       ├── pricing/page.tsx          # Pricing tiers
│       ├── about/page.tsx            # About page
│       ├── login/page.tsx            # Email + Google OAuth login
│       └── signup/page.tsx           # Registration
│
└── model_testing/                    # Offline test scripts
    ├── smoke_test.py                 # End-to-end pipeline smoke test
    ├── test_model.py                 # Model 3 NLI unit tests
    ├── evaluation_results.json       # Sample extraction evaluation
    └── conflict_results.json         # Sample conflict detection results
```

---

## Tech Stack

### Backend
| Component | Technology |
|---|---|
| Language | Python 3.11+ |
| Web Framework | Flask + Flask-CORS + Flask-Session |
| Obligation Extraction | `ckpt_obligation_fast` — fine-tuned RoBERTa on CUAD |
| Clause Extraction | Groq API (`openai/gpt-oss-120b`) |
| Conflict Detection | DistilBERT NLI (`model_3`) |
| Risk Forecasting | Facebook Prophet + scikit-learn |
| PDF Parsing | pdfplumber |
| NER (extraction fallback) | spaCy `en_core_web_sm` |
| Database | MongoDB Atlas |
| Auth | Google OAuth 2.0 + bcrypt email/password |
| Containerization | Docker |

### Frontend
| Component | Technology |
|---|---|
| Framework | Next.js 16 (App Router) with TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Animations | Framer Motion + GSAP |
| Icons | Lucide React |
| Auth | next-auth v5 |
| Font | Geist (Sans + Mono) via Google Fonts |

---

## AI Pipeline

The core obligation extraction pipeline processes contracts through 7 sequential stages:

```
PDF / Text
    │
    ▼
Stage 1: Ingestion          ← pdfplumber or raw text pass-through
    │
    ▼
Stage 2: Cleaning           ← Unicode normalization, header/footer removal,
    │                          broken line merging
    ▼
Stage 3: Segmentation       ← Paragraph-level chunking (max 1500 chars)
    │                          with 200-char overlap sliding windows
    ▼
Stage 4: QA Detection       ← RoBERTa asks 8 targeted questions per chunk
    │                          (financial limits, insurance, revenue sharing…)
    ▼
Stage 5: Span Filtering     ← Confidence threshold + financial keyword boost
    │                          + deduplication of overlapping spans
    ▼
Stage 6: Extraction         ← Hybrid rules + spaCy NER:
    │                          metric_name · operator · threshold_value
    │                          deadline · consequence
    ▼
Stage 7: Normalize          ← snake_case normalization, operator aliasing,
                               validation, JSON serialization
```

**Output per obligation:**
```json
{
  "metric_name": "debt_to_equity_ratio",
  "operator": "less_equal",
  "threshold_value": 2.5,
  "deadline": "quarterly",
  "consequence": "default",
  "confidence_score": 0.8234,
  "source_text": "The Borrower shall maintain at all times a Debt-to-Equity Ratio..."
}
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB Atlas URI
- Groq API key ([console.groq.com](https://console.groq.com))
- Google OAuth credentials (optional, for Google login)

### Backend Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/contractpulse.git
cd contractpulse

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Download spaCy model
python -m spacy download en_core_web_sm

# 4. Configure environment variables (see below)
cp backend/.env.example backend/.env

# 5. Start the Flask server
cd backend
python main.py
```

The API will be available at `http://localhost:5000`.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:5000

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Environment Variables

#### `backend/.env`

```env
# MongoDB
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/userinfo

# Groq (for clause extraction in /api/compare)
GROQ_API_KEY=gsk_...

# Google OAuth
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/callback/google

# App
SECRET_KEY=your-random-secret
FRONTEND_URL=http://localhost:3000
FLASK_ENV=development

# Model settings (optional overrides)
CONF_THRESHOLD=0.7
MAX_LEN=512
```

#### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Extract obligations from a contract (PDF upload or JSON text) |
| `POST` | `/api/compare` | Compare two contracts for conflicts using Groq + NLI |
| `POST` | `/api/conflicts` | Score a single clause pair for contradiction |
| `GET` | `/api/risk?ticker=AAPL&horizon=90` | Get Prophet breach forecast for a ticker |
| `GET` | `/api/risk/all` | Get risk summary for all available tickers |
| `GET` | `/api/risk/tickers` | List available tickers in the model |
| `POST` | `/api/process_breach` | Process a breach and auto-create tasks + meetings |
| `POST` | `/api/process_batch` | Batch process multiple breaches |
| `GET` | `/api/tasks` | List all mitigation tasks |
| `GET` | `/api/meetings` | List all scheduled meetings |
| `GET` | `/api/departments` | Get department workload summary |
| `POST` | `/auth/register` | Register with email + password |
| `POST` | `/auth/login` | Login with email + password |
| `GET` | `/auth/login/google` | Initiate Google OAuth flow |
| `GET` | `/auth/me` | Get current session user |
| `POST` | `/auth/logout` | Clear session |
| `GET` | `/health` | Health check |

### Example: Analyze a Contract

```bash
# From text
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "The Borrower shall maintain a Debt-to-Equity Ratio of not more than 2.5x, tested quarterly."}'

# From PDF
curl -X POST http://localhost:5000/api/analyze \
  -F "file=@contract.pdf"
```

### Example: Compare Two Contracts

```bash
curl -X POST http://localhost:5000/api/compare \
  -H "Content-Type: application/json" \
  -d '{
    "contract_a": "Either party may terminate with 30 days written notice.",
    "contract_b": "This agreement may only be terminated for cause after 60 days."
  }'
```

---

## Model Details

### Model 1 — Obligation Extraction (RoBERTa QA)

- **Base**: `deepset/tinyroberta-squad2` (fine-tuned on CUAD dataset)
- **Checkpoint**: `backend/ckpt_obligation_fast/`
- **Input**: Contract text chunk (≤512 tokens) + targeted question
- **Output**: Extracted span + confidence score
- **Questions asked per chunk** (8 total):
  - `financial_limits` — general financial obligation clauses
  - `minimum_commitment` — minimum order size or purchase frequency
  - `price_restrictions` — price raise/lower restrictions
  - `revenue_sharing` — revenue/profit sharing requirements
  - `cap_on_liability` — liability caps on breach
  - `liquidated_damages` — liquidated damages clauses
  - `volume_restriction` — fee increases above usage thresholds
  - `insurance` — insurance maintenance requirements

**Training:**
```bash
# Fast training (~20 min on RTX 4050 6GB)
python all_model_code/model_1_code/train_qa_fast.py \
  --train_path data/train.json \
  --output_dir backend/ckpt_obligation_fast \
  --epochs 1 \
  --max_features 12000

# Full training
python all_model_code/model_1_code/train_qa.py \
  --train_path data/train.json \
  --output_dir backend/ckpt_obligation_fast \
  --epochs 2
```

### Model 2 — Risk Forecasting (Prophet)

- **Model**: Facebook Prophet (one model per ticker)
- **Artifact**: `backend/risk_model_v10_extended.pkl`
- **Features engineered**: `returns`, `vol_14`, `momentum`, `drawdown`, `returns_5d`, `risk_raw`
- **Output**: Normalized risk score (0–100), breach prediction, days-to-breach, confidence tier
- **Supported tickers**: AAPL, MSFT, TSLA, AMD, NVDA, F, GE, BAC, JPM, NFLX, XOM, WMT, TGT, IBM

Historical data lives in `backend/data/Stocks/` as CSV files (`ticker.us.txt`).

### Model 3 — Conflict Detection (NLI DistilBERT)

- **Base**: DistilBERT fine-tuned on NLI (Natural Language Inference)
- **Checkpoint**: `backend/model_3/`
- **Labels**: `contradiction` · `neutral` · `entailment`
- **Input**: `"Clause A text [SEP] Clause B text"`
- **Output**: Label + confidence scores for all three classes
- **Threshold**: Contradictions with score ≥ 0.75 flagged as high-confidence conflicts

---

## Frontend Pages

| Route | Description |
|---|---|
| `/` | Redirects to landing page |
| `/landingpage` | Marketing home with animated stats |
| `/demo` | Interactive contract analysis playground with live highlighting |
| `/compare` | Two-contract conflict detection engine |
| `/forecast` | Prophet time-series risk dashboard |
| `/dashboard` | Portfolio overview with contract risk table |
| `/report` | AI-generated covenant risk report (printable) |
| `/scheduler` | Breach response task board with auto-meeting booking |
| `/product` | Feature breakdown (6 modules) |
| `/pricing` | Tiered pricing (Starter / Growth / Enterprise) |
| `/about` | Company vision and principles |
| `/login` | Email login + Google OAuth |
| `/signup` | Registration |

---

## Training the Models

### CUAD Dataset Setup

Download the CUAD dataset and place files at:

```
data/
├── train.json    # CUAD training split (SQuAD 2.0 format)
└── test.json     # CUAD test split
```

### Run Smoke Test

Verify the full pipeline works before training:

```bash
python model_testing/smoke_test.py
```

### Test NLI Model

```bash
python model_testing/test_model.py
```

### Test Obligation Extraction

```bash
python all_model_code/model_1_code/test_model.py
```

---

## Docker Deployment

```bash
cd backend

# Build image
docker build -t contractpulse-backend .

# Run container
docker run -p 7860:7860 \
  -e MONGO_URI="..." \
  -e GROQ_API_KEY="..." \
  -e GOOGLE_CLIENT_ID="..." \
  -e GOOGLE_CLIENT_SECRET="..." \
  -e GOOGLE_REDIRECT_URI="..." \
  -e SECRET_KEY="..." \
  -e FRONTEND_URL="https://your-frontend.com" \
  contractpulse-backend
```

The backend exposes port `7860` for HuggingFace Spaces compatibility.

---

<div align="center">
  <strong>CONTRACTPULSE</strong> — Give your contracts a heartbeat.
</div>
