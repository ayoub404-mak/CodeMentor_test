from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import os
from typing import List, Optional, Any

from config import AI_PROVIDER, STATIC_DIR, PROGRESS_FILE
from progress_manager import load_progress, init_progress, update_progress
from ai_engine import ai_engine_instance
from curriculum import get_next_topic
from code_runner import run_student_code

app = FastAPI(title="CodeMentor AI")

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/api/status")
async def get_status():
    """Check if setup is complete."""
    progress = load_progress()
    configured = False
    
    if progress is not None and ('student_id' in progress):
        # We assume if the student_progress json exists, setup is done.
        configured = True

    return {
        "configured": configured,
        "provider": AI_PROVIDER
    }

class SetupRequest(BaseModel):
    name: str
    provider: str
    api_key: str

@app.post("/api/setup")
async def setup(req: SetupRequest):
    """Initial setup to save API key and name."""
    # Write to .env
    env_content = f"AI_PROVIDER={req.provider}\n"
    if req.provider == "mistral":
        env_content += f"MISTRAL_API_KEY={req.api_key}\n"
    elif req.provider == "gemini":
        env_content += f"GEMINI_API_KEY={req.api_key}\n"
    
    with open(".env", "w") as f:
        f.write(env_content)
        
    ai_engine_instance.set_provider_and_key(req.provider, req.api_key)

    # Init progress
    init_progress(req.name)
    
    return {"success": True, "message": f"Welcome, {req.name}!"}

@app.post("/api/assessment/generate")
async def generate_assessment():
    exam = ai_engine_instance.generate_assessment()
    if not exam:
        raise HTTPException(status_code=500, detail="Failed to generate assessment")
    return exam

class AssessmentAnswers(BaseModel):
    mcq_answers: List[Any]
    coding_solutions: List[Any]

@app.post("/api/assessment/evaluate")
async def evaluate_assessment(answers: AssessmentAnswers):
    results = ai_engine_instance.evaluate_assessment(answers.dict())
    if not results:
        raise HTTPException(status_code=500, detail="Failed to evaluate assessment")
    
    # Update progress with level and learning path
    update_progress("level", results.get("level", "beginner"))
    update_progress("assessment_score", results.get("score", 0))
    update_progress("strengths", results.get("strengths", []))
    update_progress("weaknesses", results.get("weaknesses", []))
    
    # Determine first topic
    first_topic = get_next_topic(None, results.get("level", "beginner"))
    update_progress("current_topic", first_topic)
    
    return results

@app.get("/api/progress")
async def get_progress():
    progress = load_progress()
    if not progress:
         raise HTTPException(status_code=404, detail="Progress not found")
    return progress

class TutorialRequest(BaseModel):
    topic: str

@app.post("/api/tutorial")
async def generate_tutorial(req: TutorialRequest):
    progress = load_progress()
    if not progress:
        raise HTTPException(status_code=400, detail="Setup required")
    
    content = ai_engine_instance.generate_tutorial(
        req.topic, 
        progress.get("level", "beginner"),
        progress.get("completed_topics", [])
    )
    return {"content": content}

class ProblemRequest(BaseModel):
    topic: str
    problem_index: int
    last_problem: str = ""

@app.post("/api/problem/generate")
async def generate_problem(req: ProblemRequest):
    progress = load_progress()
    if not progress:
        raise HTTPException(status_code=400, detail="Setup required")

    problem = ai_engine_instance.generate_problem(
        req.topic,
        progress.get("level", "beginner"),
        req.problem_index,
        req.last_problem,
        progress.get("strengths", []),
        progress.get("weaknesses", [])
    )
    return problem

class RunCodeRequest(BaseModel):
    code: str

@app.post("/api/code/run")
async def run_code(req: RunCodeRequest):
    result = run_student_code(req.code)
    return result

class SubmitCodeRequest(BaseModel):
    code: str
    test_cases: List[dict]

@app.post("/api/code/submit")
async def submit_code(req: SubmitCodeRequest):
    result = run_student_code(req.code, req.test_cases)
    return result

class ReviewRequest(BaseModel):
    code: str
    problem: str
    passed: int
    total: int
    failed_details: str

@app.post("/api/review")
async def review_code(req: ReviewRequest):
    progress = load_progress()
    level = progress.get("level", "beginner") if progress else "beginner"
    topic = progress.get("current_topic", "unknown") if progress else "unknown"
    
    feedback = ai_engine_instance.review_code(
        level, topic, req.problem, req.code, req.passed, req.total, req.failed_details
    )
    return {"feedback": feedback}

class HintRequest(BaseModel):
    code: str
    problem: str
    hint_level: int = 1

@app.post("/api/hint")
async def generate_hint(req: HintRequest):
    hint = ai_engine_instance.generate_hint(req.code, req.problem)
    return hint

@app.post("/api/topic/next")
async def next_topic():
    progress = load_progress()
    if not progress:
        raise HTTPException(status_code=400, detail="Setup required")
        
    current = progress.get("current_topic")
    nxt = get_next_topic(current, progress.get("level", "beginner"))
    
    # Mark current as completed
    if current:
        completed = progress.get("completed_topics", [])
        if current not in completed:
            completed.append(current)
            update_progress("completed_topics", completed)
    
    update_progress("current_topic", nxt)
    update_progress("current_problem_index", 0)
    
    return {"next_topic": nxt}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
