import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Base directories
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
PROGRESS_FILE = BASE_DIR / "student_progress.json"

# AI Configuration
AI_PROVIDER = os.getenv("AI_PROVIDER", "mistral")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Execution Configuration
CODE_EXECUTION_TIMEOUT = 5
MAX_OUTPUT_LENGTH = 10000
MAX_ERROR_LENGTH = 5000

# Forbidden patterns in student code
FORBIDDEN_PATTERNS = [
    "os.system",
    "subprocess",
    "shutil",
    "__import__",
    "eval(",
    "exec("
]
