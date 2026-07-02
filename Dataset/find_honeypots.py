import json
import datetime

candidates_file = r"c:\Users\Bhanu\Desktop\RedRobAntiGravity\Dataset\candidates.jsonl"

def parse_date(d_str):
    if not d_str:
        return None
    try:
        return datetime.datetime.strptime(d_str, "%Y-%m-%d").date()
    except Exception:
        return None

honeypots = []

with open(candidates_file, "r", encoding="utf-8") as f:
    for line in f:
        if not line.strip():
            continue
        c = json.loads(line)
        cid = c["candidate_id"]
        profile = c["profile"]
        yoe = profile.get("years_of_experience", 0)
        career = c.get("career_history", [])
        skills = c.get("skills", [])
        edu = c.get("education", [])
        
        reasons = []
        
        # 1. Expert proficiency in skills with 0 duration
        expert_zero_dur = [s["name"] for s in skills if s.get("proficiency") == "expert" and s.get("duration_months") == 0]
        if len(expert_zero_dur) >= 5: # The spec says "expert proficiency in 10 skills with 0 years used"
            reasons.append(f"Expert in {len(expert_zero_dur)} skills with 0 duration: {expert_zero_dur[:5]}")
            
        # 2. Skill duration exceeding years of experience by a large margin
        for s in skills:
            sdur_years = s.get("duration_months", 0) / 12.0
            if sdur_years > yoe + 3.0: # Allow 3 years buffer for overlap/pre-work
                reasons.append(f"Skill {s['name']} duration {sdur_years:.1f} years exceeds YoE {yoe:.1f}")
                break
                
        # 3. Start date > End date in career history
        for job in career:
            start = parse_date(job.get("start_date"))
            end = parse_date(job.get("end_date"))
            if start and end and start > end:
                reasons.append(f"Job at {job.get('company')} has start date {start} > end date {end}")
                
        # 4. Job duration months does not match start and end dates (allowing some buffer)
        for job in career:
            start = parse_date(job.get("start_date"))
            end = parse_date(job.get("end_date")) or datetime.date(2026, 6, 26) # current date from metadata
            if start and end:
                expected_months = (end.year - start.year) * 12 + (end.month - start.month)
                dur = job.get("duration_months", 0)
                if dur > expected_months + 12: # Allow 1 year buffer
                    reasons.append(f"Job at {job.get('company')} lists duration {dur} months, but dates span only {expected_months} months")
                    
        # 5. Career history spans way more than YoE? Or YoE is way larger than the timeline?
        # Let's check if they have multiple overlapping jobs that are not current, or if they have total job duration exceeding their age
        # Let's check earliest education year vs career start
        if edu:
            start_years = [e["start_year"] for e in edu if e.get("start_year")]
            if start_years:
                earliest_edu = min(start_years)
                # If they started working full time way before they started college
                for job in career:
                    start = parse_date(job.get("start_date"))
                    if start and start.year < earliest_edu - 6: # Allow working 6 years before college (e.g. older student)
                        # but if it is, say, 15 years before college and they are a standard candidate, it could be a warning. Let's be careful.
                        pass

        # 6. Check company name vs start/end date anomalies (e.g. company founded 3 years ago, but 8 years of experience there)
        # Wait, how do we know if a company was founded 3 years ago?
        # Let's inspect the companies in the career history. Maybe some company names are like "OpenAI" (founded Dec 2015), or there are companies like "ChatGPT" or specific synthetic companies.
        # Let's print out some candidate profiles that have issues to see.
        
        if reasons:
            honeypots.append({
                "candidate_id": cid,
                "name": profile.get("anonymized_name"),
                "headline": profile.get("headline"),
                "yoe": yoe,
                "reasons": reasons
            })

print(f"Total potential honeypots found: {len(honeypots)}")
for hp in honeypots[:10]:
    print(f"ID: {hp['candidate_id']}, Name: {hp['name']}, YoE: {hp['yoe']}")
    for r in hp['reasons']:
        print(f"  - {r}")
