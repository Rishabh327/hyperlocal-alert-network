import math
from datetime import datetime
import weights

def get_type_risk(alert_type):
    """Returns a risk score for each alert type"""
    mapping = {
        "flood": 8.5,
        "fire": 9.2,
        "accident": 7.0,
        "gas_leak": 8.8,
        "medical": 6.5,
        "earthquake": 10.0,
        "other": 3.0
    }
    return mapping.get(alert_type, 5.0)

def calculate_time_factor(hour_of_day):
    """Returns a time credibility multiplier"""
    if 6 <= hour_of_day < 22:
        return 1.0
    elif 22 <= hour_of_day < 24:
        return 0.85
    elif 0 <= hour_of_day < 4:
        return 0.65
    elif 4 <= hour_of_day < 6:
        return 0.75
    return 1.0

def calculate_reporter_trust(reporter_score, alerts_reported):
    """Measures trust based on reporter history and credibility score"""
    if alerts_reported == 0:
        return 0.5
    elif 1 <= alerts_reported <= 5:
        return (reporter_score / 100.0) * 0.7
    elif 6 <= alerts_reported <= 20:
        return (reporter_score / 100.0) * 0.85
    else:
        return (reporter_score / 100.0) * 1.0

def calculate_confirmation_speed(corroboration_count, time_since_posted_minutes):
    """Measures how quickly people are confirming the alert"""
    if time_since_posted_minutes == 0:
        return 0
    confirmations_per_minute = corroboration_count / time_since_posted_minutes
    if confirmations_per_minute > 2.0:
        return 10
    elif confirmations_per_minute > 1.0:
        return 7
    elif confirmations_per_minute > 0.5:
        return 5
    elif confirmations_per_minute > 0.1:
        return 3
    else:
        return 0

def detect_suspicious_patterns(corroboration_count, reporter_score, hour_of_day, time_since_posted_minutes, alert_type):
    """Returns a penalty score based on suspicious parameters (higher = suspicious)"""
    penalty = 0
    if reporter_score < 30 and corroboration_count == 0:
        penalty += 20
    if (1 <= hour_of_day <= 4) and corroboration_count == 0:
        penalty += 15
    if time_since_posted_minutes > 60 and corroboration_count == 0:
        penalty += 10
    if reporter_score < 50 and (1 <= hour_of_day <= 4):
        penalty += 10
    return min(penalty, 40)

def calculate_credibility(input_data):
    """Calculates final alert credibility score and outputs analysis factors"""
    corroboration_count = input_data.get("corroboration_count", 0)
    reporter_credibility_score = input_data.get("reporter_credibility_score", 50)
    alerts_reported = input_data.get("alerts_reported", 0)
    alert_type = input_data.get("alert_type", "other")
    hour_of_day = input_data.get("hour_of_day", 12)
    time_since_posted_minutes = input_data.get("time_since_posted_minutes", 0)

    # Step 1: Get current weights
    WEIGHTS = weights.get_weights()

    # Step 2: Calculate each factor
    type_risk = get_type_risk(alert_type)
    time_mult = calculate_time_factor(hour_of_day)
    reporter_trust = calculate_reporter_trust(reporter_credibility_score, alerts_reported)
    confirmation_speed = calculate_confirmation_speed(corroboration_count, time_since_posted_minutes)
    suspicious_penalty = detect_suspicious_patterns(
        corroboration_count, reporter_credibility_score,
        hour_of_day, time_since_posted_minutes, alert_type
    )

    # Step 3: Calculate raw score using the formula
    base = 40
    corroboration_component = min(corroboration_count * WEIGHTS["corroboration"], 30)
    trust_component = reporter_trust * 100 * WEIGHTS["reporter_trust"]
    risk_component = type_risk * WEIGHTS["type_risk"]
    speed_component = confirmation_speed * WEIGHTS["confirmation_speed"]
    penalty_component = suspicious_penalty * WEIGHTS["suspicious_penalty"]

    raw_score = (base 
                 + corroboration_component 
                 + trust_component 
                 + risk_component 
                 + speed_component 
                 - penalty_component)

    # Step 4: Apply time multiplier
    adjusted_score = raw_score * time_mult

    # Step 5: Clamp score between 0 and 100
    final_score = max(0.0, min(100.0, adjusted_score))
    final_score = round(final_score, 2)

    # Step 6: Determine status using thresholds
    thresholds = weights.THRESHOLDS
    if final_score >= thresholds["verified"]:
        status = "verified"
    elif final_score <= thresholds["flagged"]:
        status = "flagged"
    else:
        status = "unverified"

    # Step 7: Build factors dict to track what contributed
    factors = {
        "base_score": base,
        "corroboration_impact": round(corroboration_component, 2),
        "reporter_trust_impact": round(trust_component, 2),
        "type_risk_impact": round(risk_component, 2),
        "confirmation_speed_impact": round(speed_component, 2),
        "suspicious_penalty": round(penalty_component, 2),
        "time_multiplier": time_mult,
        "raw_score_before_time": round(raw_score, 2)
    }

    # Step 8: Return results
    return {
        "credibility_score": final_score,
        "status": status,
        "factors": factors,
        "weights_used": dict(WEIGHTS),
        "algorithm_version": "1.0.0"
    }
