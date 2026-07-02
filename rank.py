import argparse
import json
import csv
import sys
import time
import os

# Add backend directory to path if needed
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
from agents import (
    JobIntelligenceAgent,
    CandidateProfileAgent,
    CareerIntelligenceAgent,
    SkillIntelligenceAgent,
    BehaviorIntelligenceAgent,
    CulturalFitAgent,
    HoneypotAgent,
    ScoringAgent,
    RankingAgent,
    ReasoningAgent
)

def run_ranking_pipeline(candidates_path: str, output_csv_path: str):
    print(f"Loading job description and initializing agents...")
    job_agent = JobIntelligenceAgent()
    jd_spec = job_agent.analyze_jd()
    
    profile_agent = CandidateProfileAgent()
    career_agent = CareerIntelligenceAgent(jd_spec)
    skill_agent = SkillIntelligenceAgent(jd_spec)
    behavior_agent = BehaviorIntelligenceAgent()
    culture_agent = CulturalFitAgent()
    honeypot_agent = HoneypotAgent()
    scoring_agent = ScoringAgent()
    ranking_agent = RankingAgent()
    reasoning_agent = ReasoningAgent()
    
    candidates_scored = []
    
    print(f"Reading candidates from {candidates_path}...")
    start_time = time.time()
    count = 0
    honeypot_count = 0
    
    with open(candidates_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            count += 1
            
            # Streaming parse candidate
            raw_c = json.loads(line)
            profile = profile_agent.normalize(raw_c)
            
            # Step 1: Detect Honeypots (Risk score)
            risk_data = honeypot_agent.detect_risk(profile)
            if risk_data["is_honeypot"]:
                honeypot_count += 1
                
            # Step 2: Analyze Career
            career_data = career_agent.analyze_career(profile)
            
            # Step 3: Analyze Skills
            skill_data = skill_agent.evaluate_skills(profile)
            
            # Step 4: Analyze Behavior
            behavior_data = behavior_agent.analyze_behavior(profile)
            
            # Step 5: Evaluate Culture Fit
            culture_score = culture_agent.evaluate_culture(profile, career_data)
            
            # Step 6: Compute Composite Score
            scores = scoring_agent.compute_score(
                tech_data=skill_data,
                career_data=career_data,
                behavior_data=behavior_data,
                culture_score=culture_score,
                edu_data={"education": profile["education"]},
                risk_data=risk_data
            )
            
            candidates_scored.append({
                "candidate_id": profile["candidate_id"],
                "profile": profile,
                "scores": scores,
                "career_data": career_data,
                "behavior_data": behavior_data,
                "risk_data": risk_data
            })
            
            if count % 20000 == 0:
                print(f"Scored {count} candidates...")

    print(f"Scoring complete. Scored {count} candidates in {time.time() - start_time:.2f} seconds.")
    print(f"Flagged {honeypot_count} honeypot candidates (set their score to 0.0).")
    
    # Step 7: Rank candidates
    print("Ranking candidates...")
    top_100 = ranking_agent.rank_candidates(candidates_scored)
    
    # Step 8: Generate reasoning for the top 100
    print("Generating explanations for top 100 candidates...")
    for item in top_100:
        reasoning = reasoning_agent.generate_reasoning(
            profile=item["profile"],
            scores=item["scores"],
            career_analysis=item["career_data"],
            behavior_analysis=item["behavior_data"],
            risk_analysis=item["risk_data"],
            rank=item["rank"]
        )
        item["reasoning"] = reasoning

    # Step 9: Write output CSV
    print(f"Writing results to {output_csv_path}...")
    with open(output_csv_path, "w", encoding="utf-8", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["candidate_id", "rank", "score", "reasoning"])
        for item in top_100:
            writer.writerow([
                item["candidate_id"],
                item["rank"],
                f"{item['scores']['final_score']:.4f}",
                item["reasoning"]
            ])
            
    print(f"Ranking complete! Top 100 written to {output_csv_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Redrob AI Candidate Ranking Engine")
    parser.add_argument("--candidates", required=True, help="Path to candidates.jsonl file")
    parser.add_argument("--out", required=True, help="Path to write the ranked output CSV")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.candidates):
        print(f"Error: Candidates file not found at {args.candidates}")
        sys.exit(1)
        
    run_ranking_pipeline(args.candidates, args.out)
