import json
import uuid
import os
from config import PROGRESS_FILE

def load_progress() -> dict | None:
    if not os.path.exists(PROGRESS_FILE):
        return None
    try:
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

def save_progress(data: dict) -> bool:
    try:
        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving progress: {e}")
        return False

def init_progress(name: str) -> dict:
    data = {
        "student_id": str(uuid.uuid4()),
        "name": name,
        "level": None,  # to be set after assessment
        "current_topic": None,
        "completed_topics": [],
        "current_problem_index": 0,
        "assessment_score": 0,
        "learning_path": [],
        "history": [],
        "strengths": [],
        "weaknesses": [],
        "total_problems_solved": 0,
        "streak_days": 1
    }
    save_progress(data)
    return data

def update_progress(key: str, value: any):
    data = load_progress()
    if data:
        data[key] = value
        save_progress(data)
