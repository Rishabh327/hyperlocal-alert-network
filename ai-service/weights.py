import os
import json
from datetime import datetime

# Initialize default weights
WEIGHTS = {
    "corroboration": 3.5,
    "reporter_trust": 0.25,
    "type_risk": 1.8,
    "time_factor": 1.2,
    "confirmation_speed": 2.0,
    "suspicious_penalty": 2.5
}

# Initialize default thresholds
THRESHOLDS = {
    "verified": 72,
    "flagged": 35
}

# List to store the last 100 updates
WEIGHT_HISTORY = []

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weights_data.json")

def save_weights():
    """Saves current WEIGHTS and THRESHOLDS to weights_data.json"""
    try:
        data = {
            "weights": WEIGHTS,
            "thresholds": THRESHOLDS,
            "history": WEIGHT_HISTORY
        }
        with open(DATA_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving weights: {e}")

def load_weights():
    """Loads weights and thresholds from weights_data.json if exists"""
    global WEIGHTS, THRESHOLDS, WEIGHT_HISTORY
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                data = json.load(f)
                if "weights" in data:
                    WEIGHTS.update(data["weights"])
                if "thresholds" in data:
                    THRESHOLDS.update(data["thresholds"])
                if "history" in data:
                    WEIGHT_HISTORY = data["history"]
                print("Weights and thresholds loaded from weights_data.json")
        except Exception as e:
            print(f"Error loading weights: {e}")

def update_weights(feedback_type, factors_used):
    """Updates weights based on authority feedback (genuine vs false)"""
    global WEIGHTS, WEIGHT_HISTORY
    
    # Mapping of alert factor keys to their weight keys
    factor_mapping = {
        "corroboration_impact": "corroboration",
        "reporter_trust_impact": "reporter_trust",
        "type_risk_impact": "type_risk",
        "time_multiplier": "time_factor",
        "confirmation_speed_impact": "confirmation_speed",
        "suspicious_penalty": "suspicious_penalty"
    }

    # Weight constraints (caps and floors)
    LIMITS = {
        "corroboration": {"min": 1.0, "max": 6.0},
        "reporter_trust": {"min": 0.05, "max": 0.5},
        "type_risk": {"min": 0.5, "max": 3.0},
        "time_factor": {"min": 0.3, "max": 2.0},
        "confirmation_speed": {"min": 0.5, "max": 4.0},
        "suspicious_penalty": {"min": 0.5, "max": 5.0}
    }

    if feedback_type == "genuine":
        for factor_key, val in factors_used.items():
            weight_key = factor_mapping.get(factor_key)
            if weight_key and weight_key in WEIGHTS and val > 0:
                new_weight = WEIGHTS[weight_key] + 0.05
                WEIGHTS[weight_key] = min(new_weight, LIMITS[weight_key]["max"])
    elif feedback_type == "false":
        for factor_key, val in factors_used.items():
            weight_key = factor_mapping.get(factor_key)
            if weight_key and weight_key in WEIGHTS and val > 0:
                new_weight = WEIGHTS[weight_key] - 0.05
                WEIGHTS[weight_key] = max(new_weight, LIMITS[weight_key]["min"])

    # Log to history list
    entry = {
        "timestamp": datetime.now().isoformat(),
        "feedback_type": feedback_type,
        "weights": dict(WEIGHTS)
    }
    WEIGHT_HISTORY.append(entry)
    if len(WEIGHT_HISTORY) > 100:
        WEIGHT_HISTORY = WEIGHT_HISTORY[-100:]

    save_weights()

def get_weights():
    return dict(WEIGHTS)

def get_weight_history():
    return list(WEIGHT_HISTORY)

# Call load_weights automatically upon import
load_weights()
