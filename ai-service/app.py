import os
import json
import requests
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import weights
import algorithm

app = Flask(__name__)
CORS(app)

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5000")

@app.route("/score", methods=["POST"])
def score():
    """Score a single alert and callback the Node backend with the result"""
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Missing request body"}), 400

    required_fields = [
        "alert_id",
        "corroboration_count",
        "reporter_credibility_score",
        "alerts_reported",
        "alert_type",
        "hour_of_day",
        "time_since_posted_minutes"
    ]
    for field in required_fields:
        if field not in data:
            return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400

    alert_id = data["alert_id"]
    
    # Calculate score
    result = algorithm.calculate_credibility(data)
    score_val = result["credibility_score"]
    status_val = result["status"]

    print(f"Scored alert {alert_id}: {score_val} ({status_val})")

    # Send result back to Node.js backend
    try:
        url = f"{NODE_BACKEND_URL}/api/alerts/{alert_id}/score"
        response = requests.put(url, json=result, timeout=5)
        if response.status_code == 200:
            print(f"Successfully callback to Node backend for alert {alert_id}")
        else:
            print(f"Node backend returned status {response.status_code} for alert {alert_id}")
    except Exception as e:
        print(f"Failed to callback to Node backend for alert {alert_id}: {e}")

    return jsonify(result), 200

@app.route("/score/batch", methods=["POST"])
def score_batch():
    """Score an array of alert objects"""
    alerts_list = request.get_json()
    if not isinstance(alerts_list, list):
        return jsonify({"success": False, "message": "Expected an array of alerts"}), 400

    results = []
    for alert_data in alerts_list:
        alert_id = alert_data.get("alert_id")
        if not alert_id:
            continue
        try:
            res = algorithm.calculate_credibility(alert_data)
            res["alert_id"] = alert_id
            results.append(res)
        except Exception as e:
            print(f"Error scoring batch alert {alert_id}: {e}")

    return jsonify(results), 200

@app.route("/feedback", methods=["POST"])
def feedback():
    """Process authority feedback and update weights dynamically"""
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Missing request body"}), 400

    required_fields = ["alert_id", "feedback_type", "factors_used"]
    for field in required_fields:
        if field not in data:
            return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400

    feedback_type = data["feedback_type"]
    factors_used = data["factors_used"]

    if feedback_type not in ["genuine", "false"]:
        return jsonify({"success": False, "message": "feedback_type must be 'genuine' or 'false'"}), 400

    # Trigger weights update
    weights.update_weights(feedback_type, factors_used)
    print(f"Weights updated based on {feedback_type} feedback")

    return jsonify({
        "success": True,
        "message": f"Weights updated based on {feedback_type} feedback",
        "updated_weights": weights.get_weights()
    }), 200

@app.route("/weights", methods=["GET"])
def get_weights_info():
    """Returns current weights, thresholds, and recent history"""
    history = weights.get_weight_history()
    recent = history[-5:] if len(history) >= 5 else history
    return jsonify({
        "weights": weights.get_weights(),
        "thresholds": weights.THRESHOLDS,
        "history_count": len(history),
        "recent_history": recent
    }), 200

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "algorithm": "Custom Weighted Adaptive Scoring",
        "version": "1.0.0",
        "weights_loaded": True
    }), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
