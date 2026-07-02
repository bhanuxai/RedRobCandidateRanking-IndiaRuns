import json
import csv
import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(__file__))
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

def main():
    project_root = os.path.dirname(os.path.dirname(__file__))
    submission_path = os.path.join(project_root, "submission.csv")
    candidates_path = os.path.join(project_root, "Dataset", "candidates.jsonl")
    
    # 1. Read top 100 candidates from submission.csv
    top_ids = {}
    print("Reading submission.csv...")
    with open(submission_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            if row:
                cid, rank, score, reasoning = row
                top_ids[cid] = {
                    "rank": int(rank),
                    "score": float(score),
                    "reasoning": reasoning
                }
                
    # 2. Extract full raw profiles from candidates.jsonl
    print("Extracting profiles from candidates.jsonl...")
    top_raw_candidates = {}
    total_candidates = 0
    sample_honeypots = 0
    sample_limit = 5000
    
    # Initialize agents for honeypot check during streaming
    profile_agent = CandidateProfileAgent()
    honeypot_agent = HoneypotAgent()
    
    with open(candidates_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            total_candidates += 1
            raw_c = json.loads(line)
            cid = raw_c.get("candidate_id")
            
            if cid in top_ids:
                top_raw_candidates[cid] = raw_c
                
            # Sample honeypots for statistics (up to 5000)
            if total_candidates <= sample_limit:
                profile = profile_agent.normalize(raw_c)
                risk_data = honeypot_agent.detect_risk(profile)
                if risk_data["is_honeypot"]:
                    sample_honeypots += 1
                    
            if total_candidates % 20000 == 0:
                print(f"Processed {total_candidates} candidates...")

    print(f"Total candidates: {total_candidates}")
    print(f"Honeypots in sample: {sample_honeypots}")
    
    # 3. Initialize scoring agents to re-compute score breakdowns for top 100
    job_agent = JobIntelligenceAgent()
    jd_spec = job_agent.analyze_jd()
    
    career_agent = CareerIntelligenceAgent(jd_spec)
    skill_agent = SkillIntelligenceAgent(jd_spec)
    behavior_agent = BehaviorIntelligenceAgent()
    culture_agent = CulturalFitAgent()
    scoring_agent = ScoringAgent()
    
    precalculated_results = []
    print("Scoring and formatting top 100 candidates...")
    for cid, info in sorted(top_ids.items(), key=lambda x: x[1]["rank"]):
        raw_c = top_raw_candidates.get(cid)
        if not raw_c:
            print(f"Warning: Profile for {cid} not found in candidates.jsonl")
            continue
            
        profile = profile_agent.normalize(raw_c)
        risk_data = honeypot_agent.detect_risk(profile)
        career_data = career_agent.analyze_career(profile)
        skill_data = skill_agent.evaluate_skills(profile)
        behavior_data = behavior_agent.analyze_behavior(profile)
        culture_score = culture_agent.evaluate_culture(profile, career_data)
        
        scores = scoring_agent.compute_score(
            tech_data=skill_data,
            career_data=career_data,
            behavior_data=behavior_data,
            culture_score=culture_score,
            edu_data={"education": profile["education"]},
            risk_data=risk_data
        )
        
        precalculated_results.append({
            "rank": info["rank"],
            "candidate_id": cid,
            "profile": profile,
            "scores": scores,
            "career_data": career_data,
            "behavior_data": behavior_data,
            "risk_data": risk_data,
            "reasoning": info["reasoning"]
        })
        
    # 4. Generate overall stats
    avg_score = sum(item["scores"]["final_score"] for item in precalculated_results) / len(precalculated_results) if precalculated_results else 0.0
    
    locations = {}
    skills_dist = {}
    for item in precalculated_results:
        loc = item["profile"]["location"]
        locations[loc] = locations.get(loc, 0) + 1
        
        for s in item["profile"]["skills"][:5]:
            sname = s["name"]
            skills_dist[sname] = skills_dist.get(sname, 0) + 1
            
    stats = {
        "total_candidates": total_candidates,
        "sample_honeypot_ratio": round((sample_honeypots / min(total_candidates, sample_limit)) * 100, 2) if total_candidates > 0 else 0,
        "top_100_avg_score": round(avg_score, 4),
        "locations": sorted([{"name": k, "count": v} for k, v in locations.items()], key=lambda x: -x["count"])[:5],
        "skills": sorted([{"name": k, "count": v} for k, v in skills_dist.items()], key=lambda x: -x["count"])[:10]
    }
    
    # 5. Write outputs
    results_out = os.path.join(os.path.dirname(__file__), "precalculated_results.json")
    stats_out = os.path.join(os.path.dirname(__file__), "precalculated_stats.json")
    
    print(f"Writing {results_out}...")
    with open(results_out, "w", encoding="utf-8") as out:
        json.dump(precalculated_results, out, indent=2)
        
    print(f"Writing {stats_out}...")
    with open(stats_out, "w", encoding="utf-8") as out:
        json.dump(stats, out, indent=2)
        
    print("Done generating precalculated data successfully!")

if __name__ == "__main__":
    main()
