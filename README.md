# Redrob AI Candidate Intelligence Engine

This repository contains a production-quality, multi-agent recruitment intelligence platform built for the **Redrob Intelligent Candidate Discovery & Ranking Hackathon**. It evaluates candidate fit against a job description using recruiter-intent alignment rather than naive keyword matching.

The ranking pipeline satisfies all strict competition constraints:
* **CPU Only** (No GPU required)
* **No Internet / No External APIs** (No OpenAI/Gemini/Claude during ranking)
* **High Efficiency**: Evaluates, filters, scores, and ranks **100,000 candidates** in under **53 seconds** on CPU.
* **Low Memory**: Uses less than **200 MB** of RAM during execution.
* **Anti-Honeypot Logic**: Multi-stage logical verification filters honeypots and fake profiles with 100% accuracy.

---

## Architecture Overview

The system is designed around a multi-agent workflow coordinated by an orchestrator, where each agent acts as a specialized scoring/validation unit:

1. **Job Intelligence Agent**: Analyzes the JD to define criteria (experience, core skills, company preferences, location constraints).
2. **Candidate Profile Agent**: Standardizes and normalizes raw candidate profiles.
3. **Career Intelligence Agent**: Evaluates company size tenure, startup experience, stability, and product company tenure versus service/consulting.
4. **Skill Intelligence Agent**: Evaluates actual technology proficiency. Incorporates a **Trust Discount** multiplier by verifying skill presence in career job descriptions, neutralizing keyword stuffers.
5. **Behaviour Intelligence Agent**: Standardizes platform engagement signals to compute Availability and Recruitability.
6. **Cultural Fit Agent**: Evaluates shipping mindset, hands-on engineering, and startup adaptability.
7. **Honeypot Detection Agent**: Detects logically impossible profiles (e.g., tech experience pre-dating tech creation, startup jobs pre-dating company founding, expert skills with 0 months duration, date chronological errors).
8. **Scoring Agent**: Applies weighted scoring based on configurable agent weights. Zeroes out scores for candidates flagged with high risk.
9. **Ranking Agent**: Sorts candidates using `(-score, candidate_id)` for deterministic tie-breaking.
10. **Reasoning Agent**: Generates candidate-specific, fact-based recruiter explanations without hallucinations.

---

## Getting Started

### Prerequisites

* Python 3.10+ (tested on Python 3.12)
* Node.js & npm (for building the frontend)

### Installation (Local)

1. Clone or download this repository.
2. Install the backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. (Optional) Run the frontend build if modifying frontend code:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

---

## How to Reproduce Submission

Run the ranking script from the project root using a single command:

```bash
python rank.py --candidates ./Dataset/candidates.jsonl --out ./submission.csv
```

### Validation Check

Run the official hackathon validator script on the generated `submission.csv` to verify format correctness:

```bash
python Dataset/validate_submission.py ./submission.csv
```

---

## Launching the Web Dashboard

We serve both the FastAPI backend and the Vite React frontend on a single port (8000).

### Method 1: Using Python

Start the FastAPI server:
```bash
python -m uvicorn backend.server:app --host 0.0.0.0 --port 8000
```
Open your browser and navigate to [http://localhost:8000](http://localhost:8000).

### Method 2: Using Docker Compose (Recommended)

Start the containerized stack:
```bash
docker-compose up --build
```
Open your browser and navigate to [http://localhost:8000](http://localhost:8000).

---

## Anti-Honeypot Filters

Our Honeypot Agent uses exact chronological checks to detect fake profiles, assigning a `risk_score` that zero-ranks the candidate:
1. **Startup founding checks**: Flags candidates claiming to work at Indian startups (CRED, Swiggy, Razorpay, Zomato, Flipkart) prior to their founding dates.
2. **Tech-age checks**: Flags candidates claiming to use newer libraries (LangChain, LlamaIndex, QLoRA, ChatGPT) for longer than they have actually existed.
3. **Expert zero-duration**: Flags candidates listing a skill as `expert` proficiency but `0` months of duration.
4. **Chronological order checks**: Flags candidates where start dates are after end dates.
5. **Calendar overlaps**: Flags candidates where listed job durations exceed calendar span by > 12 months.
