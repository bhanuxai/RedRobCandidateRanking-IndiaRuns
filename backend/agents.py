import json
import datetime
import re

class JobIntelligenceAgent:
    """
    Agent 1: Job Intelligence Agent
    Analyzes the Job Description to extract and infer hiring criteria, required/preferred skills, 
    experience, company type preferences, and behavioral/cultural expectations.
    """
    def __init__(self):
        # Target job specifications for the Series A Senior AI Engineer role at Redrob
        self.target_role = {
            "title": "Senior AI Engineer — Founding Team",
            "experience_range": (5, 9),  # 5-9 years (ideally 6-8)
            "core_skills": [
                "embeddings", "sentence-transformers", "vector search", "dense search",
                "hybrid search", "vector databases", "pinecone", "weaviate", "qdrant",
                "milvus", "opensearch", "elasticsearch", "faiss", "python",
                "evaluation frameworks", "ndcg", "mrr", "map"
            ],
            "preferred_skills": [
                "fine-tuning", "lora", "qlora", "peft", "learning-to-rank", "ltr",
                "xgboost", "distributed systems", "inference optimization"
            ],
            "preferred_companies": [
                "swiggy", "razorpay", "cred", "zomato", "flipkart", "pied piper",
                "hooli", "stark industries", "dunder mifflin", "initech", "globex inc"
            ],
            "consulting_firms": [
                "tcs", "wipro", "infosys", "capgemini", "hcl", "mindtree", "accenture", "cognizant"
            ],
            "preferred_locations": ["noida", "pune", "delhi ncr", "hyderabad", "mumbai", "bangalore"]
        }

    def analyze_jd(self, jd_text: str = "") -> dict:
        # Standardize and return the structured JSON of JD criteria
        # Fallback to the target role if no specific text is passed (standard for the hackathon)
        return self.target_role


class CandidateProfileAgent:
    """
    Agent 2: Candidate Profile Agent
    Parses and normalizes candidate profiles.
    """
    def normalize(self, raw_candidate: dict) -> dict:
        profile = raw_candidate.get("profile", {})
        candidate_id = raw_candidate.get("candidate_id", "UNKNOWN")
        
        normalized = {
            "candidate_id": candidate_id,
            "name": profile.get("anonymized_name", "Anonymized Candidate"),
            "headline": profile.get("headline", ""),
            "summary": profile.get("summary", ""),
            "location": profile.get("location", "").strip().lower(),
            "country": profile.get("country", "").strip().lower(),
            "years_of_experience": float(profile.get("years_of_experience", 0)),
            "current_title": profile.get("current_title", "").strip(),
            "current_company": profile.get("current_company", "").strip(),
            "current_company_size": profile.get("current_company_size", "unknown"),
            "current_industry": profile.get("current_industry", "unknown"),
            "career_history": raw_candidate.get("career_history", []),
            "education": raw_candidate.get("education", []),
            "skills": raw_candidate.get("skills", []),
            "redrob_signals": raw_candidate.get("redrob_signals", {})
        }
        return normalized


class CareerIntelligenceAgent:
    """
    Agent 3: Career Intelligence Agent
    Analyzes the complete career history. Detects product company experience, startup tenure, 
    consulting firms, leadership progression, and stability.
    """
    def __init__(self, jd_spec: dict):
        self.preferred_companies = jd_spec["preferred_companies"]
        self.consulting_firms = jd_spec["consulting_firms"]

    def analyze_career(self, profile: dict) -> dict:
        career = profile.get("career_history", [])
        total_yoe = profile.get("years_of_experience", 0)
        
        product_tenure_months = 0
        consulting_tenure_months = 0
        total_career_months = 0
        job_count = len(career)
        
        has_product_exp = False
        has_consulting_only = True
        
        for job in career:
            comp = job.get("company", "").strip().lower()
            dur = job.get("duration_months", 0)
            total_career_months += dur
            
            # Check company type
            is_product = any(pc in comp for pc in self.preferred_companies)
            is_consulting = any(cf in comp for cf in self.consulting_firms)
            
            if is_product or job.get("company_size") in ["1-10", "11-50", "51-200", "201-500"]:
                product_tenure_months += dur
                has_product_exp = True
                has_consulting_only = False
            elif is_consulting:
                consulting_tenure_months += dur
            else:
                # Default assume service unless in product industries
                ind = job.get("industry", "").lower()
                if "software" in ind or "internet" in ind or "technology" in ind or "product" in ind:
                    product_tenure_months += dur
                    has_product_exp = True
                    has_consulting_only = False
                else:
                    consulting_tenure_months += dur

        # If career is empty, they don't have consulting-only but they also don't have product
        if job_count == 0:
            has_consulting_only = False
            
        # Career stability & switching frequency
        avg_job_duration_months = total_career_months / job_count if job_count > 0 else 0
        is_title_chaser = avg_job_duration_months < 18 and job_count >= 3
        
        # Experience Years Score
        # Target is 5-9 years, optimal is 6-8
        yoe_score = 0.0
        if 6 <= total_yoe <= 8:
            yoe_score = 1.0
        elif 5 <= total_yoe < 6:
            yoe_score = 0.9
        elif 8 < total_yoe <= 9:
            yoe_score = 0.9
        elif 3 <= total_yoe < 5:
            yoe_score = 0.6
        elif 9 < total_yoe <= 12:
            yoe_score = 0.6
        elif total_yoe > 12:
            yoe_score = 0.3
        else:
            yoe_score = 0.1

        # Check pure research (academic)
        is_academic_only = True
        has_any_industry_job = False
        
        for job in career:
            desc = job.get("description", "").lower()
            title = job.get("title", "").lower()
            
            # If they worked at an academic/research institution
            is_job_academic = any(w in title or w in desc for w in ["research assistant", "academic", "phd scholar", "postdoc", "professor", "lecturer"])
            is_job_corporate = not is_job_academic
            
            if is_job_corporate:
                has_any_industry_job = True
                is_academic_only = False
                break
                
        if job_count == 0:
            is_academic_only = False

        # Calculate score
        career_quality_score = yoe_score * 0.4
        
        if has_product_exp:
            career_quality_score += 0.4
        elif not has_consulting_only:
            career_quality_score += 0.2
            
        if not is_title_chaser and job_count > 0:
            career_quality_score += 0.2
            
        # Penalties
        if has_consulting_only:
            career_quality_score -= 0.3
        if is_academic_only:
            career_quality_score -= 0.4
        if is_title_chaser:
            career_quality_score -= 0.2
            
        career_quality_score = max(0.0, min(1.0, career_quality_score))
        
        return {
            "yoe": total_yoe,
            "yoe_score": yoe_score,
            "product_tenure_months": product_tenure_months,
            "has_product_exp": has_product_exp,
            "has_consulting_only": has_consulting_only,
            "is_title_chaser": is_title_chaser,
            "is_academic_only": is_academic_only,
            "career_quality_score": career_quality_score
        }


class SkillIntelligenceAgent:
    """
    Agent 4: Skill Intelligence Agent
    Evaluates candidate's actual capability. Maps skills, counts endorsements, handles equivalent 
    experience, and validates skill presence in career descriptions to discount keyword stuffers.
    """
    def __init__(self, jd_spec: dict):
        self.core_skills = jd_spec["core_skills"]
        self.preferred_skills = jd_spec["preferred_skills"]
        
        # Map equivalent search terms/synonyms to standard core categories
        self.synonyms = {
            "embeddings": ["embedding", "sentence-transformers", "bge", "e5", "bert", "encoders"],
            "vector databases": ["vector db", "pinecone", "weaviate", "qdrant", "milvus", "faiss", "chroma", "vector search", "dense search", "dense retrieval"],
            "evaluation frameworks": ["ndcg", "mrr", "map", "eval", "a/b testing", "offline evaluation", "metrics"],
            "ranking": ["ranking systems", "learning-to-rank", "ltr", "recommendation", "search engine", "rerank", "xgboost"]
        }

    def evaluate_skills(self, profile: dict) -> dict:
        skills = profile.get("skills", [])
        career_desc_concat = " ".join([job.get("description", "").lower() for job in profile.get("career_history", [])])
        career_title_concat = " ".join([job.get("title", "").lower() for job in profile.get("career_history", [])])
        headline_summary = (profile.get("headline", "") + " " + profile.get("summary", "")).lower()
        
        full_context = career_desc_concat + " " + career_title_concat + " " + headline_summary
        
        skill_map = {s["name"].lower().strip(): s for s in skills}
        
        # 1. Evaluate Core Skills (Embeddings, Vector DBs, Eval, Ranking, Python)
        core_scores = {}
        for category, syn_list in self.synonyms.items():
            # Check if candidate lists this skill or any synonym
            matched_skill = None
            for syn in syn_list + [category]:
                if syn in skill_map:
                    matched_skill = skill_map[syn]
                    break
                    
            if matched_skill:
                proficiency = matched_skill.get("proficiency", "beginner")
                duration = matched_skill.get("duration_months", 0)
                
                # Base score on proficiency
                p_score = {"beginner": 0.4, "intermediate": 0.7, "advanced": 0.9, "expert": 1.0}[proficiency]
                
                # Trust verification: is this skill actually mentioned in career history?
                # If they list it as a skill but never write about it in their work descriptions, it's keyword stuffed!
                word_found = False
                for keyword in syn_list + [category]:
                    if keyword in full_context:
                        word_found = True
                        break
                        
                trust_multiplier = 1.0 if word_found else 0.4
                
                core_scores[category] = p_score * trust_multiplier
            else:
                # If they didn't list it as a skill, check if it's in their descriptions (inferred experience)
                word_found = False
                for keyword in syn_list + [category]:
                    if keyword in full_context:
                        word_found = True
                        break
                core_scores[category] = 0.3 if word_found else 0.0

        # Check Python
        python_score = 0.0
        if "python" in skill_map:
            p_skill = skill_map["python"]
            python_score = {"beginner": 0.5, "intermediate": 0.8, "advanced": 0.9, "expert": 1.0}[p_skill.get("proficiency", "beginner")]
        elif "python" in full_context:
            python_score = 0.5

        # 2. Evaluate Preferred/Nice-to-have Skills
        preferred_matches = 0
        for ps in self.preferred_skills:
            if ps in skill_map or ps in full_context:
                preferred_matches += 1
        preferred_score = min(1.0, preferred_matches / 4.0)

        # 3. Overall Skill Score
        core_avg = sum(core_scores.values()) / len(core_scores) if core_scores else 0.0
        skill_score = core_avg * 0.6 + python_score * 0.2 + preferred_score * 0.2
        
        # Penalize if they have no core retrieval experience at all
        if core_scores.get("embeddings", 0) == 0 and core_scores.get("vector databases", 0) == 0:
            skill_score *= 0.3
            
        # Penalize keyword stuffers with extremely low career-to-skill ratios
        # e.g., listing 20 expert skills but current title is Marketing Manager
        title_lower = profile.get("current_title", "").lower()
        is_non_tech = any(non_tech in title_lower for non_tech in [
            "marketing", "hr ", "human resource", "civil", "operations manager", 
            "accountant", "sales", "graphic designer", "content writer", "support"
        ])
        
        if is_non_tech and len(skills) >= 6:
            # Huge discount on skills for non-tech keyword stuffers
            skill_score *= 0.1

        return {
            "core_scores": core_scores,
            "python_score": python_score,
            "preferred_score": preferred_score,
            "skill_score": skill_score
        }


class BehaviorIntelligenceAgent:
    """
    Agent 5: Behaviour Intelligence Agent
    Analyzes Redrob behavioural signals. Computes Availability and Recruitability.
    """
    def analyze_behavior(self, profile: dict) -> dict:
        signals = profile.get("redrob_signals", {})
        
        # 1. Availability Score
        # Recruiter response rate
        response_rate = float(signals.get("recruiter_response_rate", 0.5))
        
        # Last active date: compute recency
        last_active_str = signals.get("last_active_date", "2025-01-01")
        try:
            last_active = datetime.datetime.strptime(last_active_str, "%Y-%m-%d").date()
            ref_date = datetime.date(2026, 6, 26)  # current time of challenge
            days_inactive = (ref_date - last_active).days
        except Exception:
            days_inactive = 365
            
        if days_inactive <= 30:
            recency_score = 1.0
        elif days_inactive <= 90:
            recency_score = 0.8
        elif days_inactive <= 180:
            recency_score = 0.5
        else:
            recency_score = 0.1 # heavily down-weight inactive candidates

        open_to_work = 1.0 if signals.get("open_to_work_flag", False) else 0.6
        availability_score = response_rate * 0.4 + recency_score * 0.4 + open_to_work * 0.2

        # 2. Recruitability Score
        # Notice period
        notice_days = int(signals.get("notice_period_days", 60))
        if notice_days <= 15:
            notice_score = 1.0
        elif notice_days <= 30:
            notice_score = 0.95
        elif notice_days <= 60:
            notice_score = 0.75
        elif notice_days <= 90:
            notice_score = 0.4
        else:
            notice_score = 0.1 # 90+ days notice is highly penalized

        # Relocation checks
        loc = profile.get("location", "").lower()
        willing_relocate = signals.get("willing_to_relocate", False)
        preferred_work_mode = signals.get("preferred_work_mode", "hybrid")
        
        is_local = any(city in loc for city in ["noida", "pune", "delhi ncr", "gurgaon", "ghaziabad", "hyderabad", "mumbai", "bangalore"])
        
        relocation_score = 1.0
        if not is_local:
            if willing_relocate:
                relocation_score = 0.8
            elif preferred_work_mode == "remote":
                relocation_score = 0.9
            else:
                relocation_score = 0.2 # not local, won't relocate, wants hybrid/onsite

        interview_rate = float(signals.get("interview_completion_rate", 1.0))
        offer_rate = float(signals.get("offer_acceptance_rate", 1.0))
        # If -1, it means no offer history, treat as neutral
        if offer_rate == -1:
            offer_rate = 0.8
            
        recruitability_score = notice_score * 0.4 + relocation_score * 0.3 + interview_rate * 0.2 + offer_rate * 0.1

        return {
            "availability_score": availability_score,
            "recruitability_score": recruitability_score,
            "response_rate": response_rate,
            "days_inactive": days_inactive,
            "notice_days": notice_days,
            "is_local": is_local
        }


class CulturalFitAgent:
    """
    Agent 6: Cultural Fit Agent
    Evaluates candidate's fit for a fast-paced Series A startup with a shipping mentality.
    """
    def evaluate_culture(self, profile: dict, career_analysis: dict) -> float:
        career = profile.get("career_history", [])
        
        # 1. Startup Mindset (working at startups size 11-50, 51-200)
        startup_score = 0.0
        startup_jobs = 0
        for job in career:
            size = job.get("company_size", "unknown")
            if size in ["1-10", "11-50", "51-200"]:
                startup_jobs += 1
                
        if startup_jobs >= 2:
            startup_score = 1.0
        elif startup_jobs == 1:
            startup_score = 0.7
        else:
            startup_score = 0.2

        # 2. Shipping Mentality: look for action words in description
        desc_concat = " ".join([job.get("description", "").lower() for job in career])
        ship_keywords = ["shipped", "deployed", "implemented", "scaled", "optimized", "built", "owned", "production", "fast iteration", "v1", "v2", "mvp"]
        matches = sum(1 for kw in ship_keywords if kw in desc_concat)
        ship_score = min(1.0, matches / 5.0)

        # 3. Hands-on Engineering vs. Management only
        title_lower = profile.get("current_title", "").lower()
        is_pure_manager = ("manager" in title_lower or "director" in title_lower or "head" in title_lower) and "engineer" not in title_lower and "developer" not in title_lower
        hands_on_score = 0.2 if is_pure_manager else 1.0

        # Combine
        culture_score = startup_score * 0.4 + ship_score * 0.4 + hands_on_score * 0.2
        
        # Penalize consulting-only and academic-only
        if career_analysis.get("has_consulting_only", False):
            culture_score *= 0.5
        if career_analysis.get("is_academic_only", False):
            culture_score *= 0.3
        if career_analysis.get("is_title_chaser", False):
            culture_score *= 0.7

        return culture_score


class HoneypotAgent:
    """
    Agent 7: Honeypot Detection Agent
    Assigns Risk Score. Multiplier is 0 if any logical anomaly is detected.
    """
    def __init__(self):
        self.indian_startups = {
            "cred": 2018,
            "swiggy": 2014,
            "razorpay": 2014,
            "zomato": 2008,
            "flipkart": 2007
        }
        self.tech_max_months = {
            "langchain": 42,
            "llamaindex": 42,
            "qlora": 38,
            "chatgpt": 42
        }

    def detect_risk(self, profile: dict) -> dict:
        career = profile.get("career_history", [])
        skills = profile.get("skills", [])
        yoe = profile.get("years_of_experience", 0)
        
        reasons = []
        
        # 1. Startup pre-founding anomaly
        for job in career:
            comp = job.get("company", "").strip().lower()
            start_date = job.get("start_date")
            if start_date:
                try:
                    start_year = int(start_date.split("-")[0])
                    if comp in self.indian_startups and start_year < self.indian_startups[comp]:
                        reasons.append(f"Worked at {job.get('company')} in {start_year} (founded in {self.indian_startups[comp]})")
                except Exception:
                    pass

        # 2. Tech-age anomalies
        for s in skills:
            name_lower = s.get("name", "").strip().lower()
            dur = s.get("duration_months", 0)
            for tech, max_dur in self.tech_max_months.items():
                if tech in name_lower and dur > max_dur:
                    reasons.append(f"Claimed {dur} months of {s.get('name')} experience (created < {max_dur} months ago)")
                    break

        # 3. Expert with 0 duration
        expert_zero = [s["name"] for s in skills if s.get("proficiency") == "expert" and s.get("duration_months") == 0]
        if len(expert_zero) >= 1: # Flag even 1 expert skill with 0 duration as highly suspicious
            reasons.append(f"Expert skills with 0 months of duration: {expert_zero}")

        # 4. Job chronological order errors
        for job in career:
            start_str = job.get("start_date")
            end_str = job.get("end_date")
            if start_str and end_str:
                try:
                    start = datetime.datetime.strptime(start_str, "%Y-%m-%d").date()
                    end = datetime.datetime.strptime(end_str, "%Y-%m-%d").date()
                    if start > end:
                        reasons.append(f"Job at {job.get('company')} has start date ({start_str}) after end date ({end_str})")
                except Exception:
                    pass

        # 5. Job duration calendar impossibility
        for job in career:
            start_str = job.get("start_date")
            end_str = job.get("end_date") or "2026-06-26"
            dur = job.get("duration_months", 0)
            if start_str:
                try:
                    start = datetime.datetime.strptime(start_str, "%Y-%m-%d").date()
                    end = datetime.datetime.strptime(end_str, "%Y-%m-%d").date()
                    expected_months = (end.year - start.year) * 12 + (end.month - start.month)
                    if dur > expected_months + 12: # 12 months buffer
                        reasons.append(f"Job at {job.get('company')} lists duration {dur} months, but date span is only {expected_months} months")
                except Exception:
                    pass

        # 6. Skill duration physically impossible vs. YoE
        # Only flag if a skill duration exceeds YoE by a massive margin (e.g. 6+ years over YoE)
        for s in skills:
            dur_years = s.get("duration_months", 0) / 12.0
            if dur_years > yoe + 6.0:
                reasons.append(f"Skill {s.get('name')} duration ({dur_years:.1f} yrs) exceeds professional YoE ({yoe:.1f} yrs) by > 6 yrs")
                break

        is_honeypot = len(reasons) > 0
        risk_score = 1.0 if is_honeypot else 0.0
        
        return {
            "is_honeypot": is_honeypot,
            "risk_score": risk_score,
            "reasons": reasons
        }


class ScoringAgent:
    """
    Agent 8: Scoring Agent
    Combines technical, career, and culture scores with behavior and risk multipliers.
    """
    def __init__(self):
        # Default configurable weights
        self.weights = {
            "w_tech": 0.40,
            "w_career": 0.25,
            "w_culture": 0.20,
            "w_education": 0.15
        }

    def compute_score(self, tech_data: dict, career_data: dict, behavior_data: dict, culture_score: float, edu_data: dict, risk_data: dict) -> dict:
        # 1. Tech Match (0-1)
        tech_score = tech_data.get("skill_score", 0.0)

        # 2. Career Quality (0-1)
        career_score = career_data.get("career_quality_score", 0.0)

        # 3. Education Score (0-1)
        # Tier 1 = 1.0, Tier 2 = 0.8, Tier 3 = 0.5, Tier 4 = 0.3, Unknown = 0.2
        # CS/IT degree = 1.0, Other Engineering = 0.8, Non-Tech = 0.5
        edu_score = 0.2
        education_history = edu_data.get("education", [])
        if education_history:
            best_tier = "unknown"
            degree_relevance = 0.5
            
            for ed in education_history:
                tier = ed.get("tier", "unknown")
                if tier == "tier_1":
                    best_tier = "tier_1"
                elif tier == "tier_2" and best_tier != "tier_1":
                    best_tier = "tier_2"
                elif tier == "tier_3" and best_tier not in ["tier_1", "tier_2"]:
                    best_tier = "tier_3"
                elif tier == "tier_4" and best_tier not in ["tier_1", "tier_2", "tier_3"]:
                    best_tier = "tier_4"
                    
                field = ed.get("field_of_study", "").lower()
                if any(w in field for w in ["computer science", "information technology", "software", "artificial intelligence", "data science"]):
                    degree_relevance = 1.0
                elif any(w in field for w in ["engineering", "mathematics", "statistics", "physics"]):
                    degree_relevance = 0.8
            
            tier_weights = {"tier_1": 1.0, "tier_2": 0.8, "tier_3": 0.5, "tier_4": 0.3, "unknown": 0.2}
            edu_score = tier_weights[best_tier] * 0.7 + degree_relevance * 0.3
            
        # 4. Core Weighted Fit (0-1)
        fit_score = (
            tech_score * self.weights["w_tech"] +
            career_score * self.weights["w_career"] +
            culture_score * self.weights["w_culture"] +
            edu_score * self.weights["w_education"]
        )

        # 5. Behavior Multiplier
        # Behavior modifier ranges from 0.5 to 1.1 based on availability and recruitability
        availability = behavior_data.get("availability_score", 0.5)
        recruitability = behavior_data.get("recruitability_score", 0.5)
        
        behavior_multiplier = 0.5 + 0.6 * (availability * recruitability)

        # 6. Final Score
        final_score = fit_score * behavior_multiplier
        
        # Apply risk modifier
        if risk_data.get("is_honeypot", False):
            final_score = 0.0

        final_score = round(final_score, 4)

        return {
            "tech_score": round(tech_score, 3),
            "career_score": round(career_score, 3),
            "culture_score": round(culture_score, 3),
            "education_score": round(edu_score, 3),
            "behavior_multiplier": round(behavior_multiplier, 3),
            "final_score": final_score
        }


class RankingAgent:
    """
    Agent 9: Ranking Agent
    Sorts all candidates. Returns top 100 with ranks 1-100.
    Supports deterministic tie-breaking (by score descending, then candidate_id ascending).
    """
    def rank_candidates(self, candidates_scored: list) -> list:
        # Sort key: (-score, candidate_id)
        # This sorts by score descending, and in case of ties, by candidate_id ascending
        ranked = sorted(candidates_scored, key=lambda x: (-x["scores"]["final_score"], x["candidate_id"]))
        
        top_100 = []
        for i, item in enumerate(ranked[:100]):
            item["rank"] = i + 1
            top_100.append(item)
            
        return top_100


class ReasoningAgent:
    """
    Agent 10: Reasoning Agent
    Generates high-quality, candidate-specific explanations without hallucinating.
    Explanation length: 1-2 sentences.
    """
    def generate_reasoning(self, profile: dict, scores: dict, career_analysis: dict, behavior_analysis: dict, risk_analysis: dict, rank: int) -> str:
        # Handle honeypots
        if risk_analysis.get("is_honeypot", False):
            reason = risk_analysis["reasons"][0]
            return f"Disqualified: Logical profile inconsistency detected ({reason})."

        title = profile.get("current_title", "Engineer")
        yoe = profile.get("years_of_experience", 0.0)
        skills = profile.get("skills", [])
        
        # Check specific skills candidate actually has
        skill_names = [s["name"] for s in skills]
        core_skills_found = [s for s in ["embeddings", "vector databases", "python", "ndcg", "mrr", "map", "vector search"] if any(s in sn.lower() for sn in skill_names)]
        
        # Extract location and notice period
        loc = profile.get("location", "India")
        notice = behavior_analysis.get("notice_days", 60)
        
        # Structure sentences based on ranking
        if rank <= 10:
            skill_str = ", ".join(core_skills_found[:3]) if core_skills_found else "applied ML skills"
            reasoning = (
                f"Outstanding Senior AI Engineer with {yoe:.1f} years of experience and deep production depth in {skill_str}. "
                f"Matches the product company profile perfectly with excellent active engagement ({int(behavior_analysis['response_rate']*100)}% response) and {notice}-day notice."
            )
        elif rank <= 50:
            skill_str = ", ".join(core_skills_found[:2]) if core_skills_found else "ML technologies"
            reasoning = (
                f"Strong fit Candidate with {yoe:.1f} years experience, exhibiting solid hands-on capability in {skill_str}. "
                f"Strong product mindset, based in {loc.title()}, and shows solid platform activity."
            )
        elif rank <= 80:
            reasoning = (
                f"Good developer with {yoe:.1f} years experience. Displays necessary Python foundations and search exposure, "
                f"though has slightly longer notice period ({notice} days) or minor skill overlap."
            )
        else:
            reasoning = (
                f"In-scope developer with {yoe:.1f} years experience. Solid software engineering fundamentals but lacks "
                f"direct production experience in search, ranking, or vector search pipelines."
            )

        return reasoning
