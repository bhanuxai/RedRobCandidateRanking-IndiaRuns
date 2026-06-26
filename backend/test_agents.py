import json
import os
import sys

# Add directory to path
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

def test_pipeline_on_sample():
    print("Starting agent unit tests...")
    
    sample_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Dataset", "sample_candidates.json")
    if not os.path.exists(sample_file):
        print(f"Sample file not found at {sample_file}")
        return False
        
    with open(sample_file, "r", encoding="utf-8") as f:
        candidates = json.load(f)
        
    print(f"Loaded {len(candidates)} sample candidates for testing.")
    
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
    
    # Assertions on each candidate
    for idx, c in enumerate(candidates):
        profile = profile_agent.normalize(c)
        assert profile["candidate_id"].startswith("CAND_"), f"Invalid ID: {profile['candidate_id']}"
        
        risk_data = honeypot_agent.detect_risk(profile)
        assert "is_honeypot" in risk_data
        
        career_data = career_agent.analyze_career(profile)
        assert 0.0 <= career_data["career_quality_score"] <= 1.0, f"Career score out of bounds: {career_data['career_quality_score']}"
        
        skill_data = skill_agent.evaluate_skills(profile)
        assert 0.0 <= skill_data["skill_score"] <= 1.0, f"Skill score out of bounds: {skill_data['skill_score']}"
        
        behavior_data = behavior_agent.analyze_behavior(profile)
        assert 0.0 <= behavior_data["availability_score"] <= 1.0
        assert 0.0 <= behavior_data["recruitability_score"] <= 1.0
        
        culture_score = culture_agent.evaluate_culture(profile, career_data)
        assert 0.0 <= culture_score <= 1.0
        
        scores = scoring_agent.compute_score(
            tech_data=skill_data,
            career_data=career_data,
            behavior_data=behavior_data,
            culture_score=culture_score,
            edu_data={"education": profile["education"]},
            risk_data=risk_data
        )
        
        if risk_data["is_honeypot"]:
            assert scores["final_score"] == 0.0, f"Honeypot candidate scored > 0: {scores['final_score']}"
        else:
            assert 0.0 <= scores["final_score"] <= 1.0, f"Final score out of bounds: {scores['final_score']}"
            
        candidates_scored.append({
            "candidate_id": profile["candidate_id"],
            "profile": profile,
            "scores": scores,
            "career_data": career_data,
            "behavior_data": behavior_data,
            "risk_data": risk_data
        })
        
    # Test Ranking
    top_100 = ranking_agent.rank_candidates(candidates_scored)
    assert len(top_100) > 0, "No candidates ranked"
    
    # Test Reasoning
    for i, item in enumerate(top_100):
        item["rank"] = i + 1
        reasoning = reasoning_agent.generate_reasoning(
            profile=item["profile"],
            scores=item["scores"],
            career_analysis=item["career_data"],
            behavior_analysis=item["behavior_data"],
            risk_analysis=item["risk_data"],
            rank=item["rank"]
        )
        assert len(reasoning) > 0, "Reasoning is empty"
        assert not reasoning.startswith("Disqualified") or item["scores"]["final_score"] == 0.0, "Disqualified reason on valid candidate"
        
    print("All agent unit tests passed successfully!")
    return True

if __name__ == "__main__":
    test_pipeline_on_sample()
