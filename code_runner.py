import subprocess
from config import CODE_EXECUTION_TIMEOUT, MAX_OUTPUT_LENGTH, MAX_ERROR_LENGTH, FORBIDDEN_PATTERNS
import json
import uuid
import os

def run_student_code(code: str, test_cases: list = None) -> dict:
    """Execute student Python code in a restricted subprocess."""
    
    # 1. Dangerous imports check
    for pattern in FORBIDDEN_PATTERNS:
        if pattern in code:
            return {"stdout": "", "stderr": f"Forbidden: {pattern} is not allowed for security reasons.", "exit_code": 1}

    # 2. Add test cases execution if provided
    exec_code = code
    if test_cases:
        # Wrap the whole code in a test runner structure
        test_runner = f"""
import json
results = []
try:
{chr(10).join(['    ' + line for line in code.split(chr(10))])}

    # Test cases defined
    tests = {json.dumps(test_cases)}
    
    for t in tests:
        inp = t.get("input", "")
        expected = t.get("expected", "")
        # Very simple evaluation for MVP purposes
        # Assuming input is a function call like `func_name(1, 2)`
        
        try:
            actual = eval(inp)
            passed = str(actual) == str(expected)
            results.append({{"input": inp, "expected": expected, "actual": str(actual), "passed": passed}})
        except Exception as e:
            results.append({{"input": inp, "expected": expected, "actual": str(e), "passed": False}})
except Exception as e:
    print(f"Compilation/Runtime error: {{e}}")

print("---TEST_RESULTS---")
print(json.dumps(results))
"""
        exec_code = test_runner

    # 3. Create a temporary file to run
    tmp_file = f"temp_run_{uuid.uuid4().hex[:8]}.py"
    with open(tmp_file, "w", encoding="utf-8") as f:
        f.write(exec_code)

    stdout_str = ""
    stderr_str = ""
    exit_code = 0

    try:
        result = subprocess.run(
            ["python", tmp_file],
            capture_output=True,
            text=True,
            timeout=CODE_EXECUTION_TIMEOUT
        )
        stdout_str = result.stdout[:MAX_OUTPUT_LENGTH]
        stderr_str = result.stderr[:MAX_ERROR_LENGTH]
        exit_code = result.returncode
    except subprocess.TimeoutExpired:
        stderr_str = f"Execution timed out after {CODE_EXECUTION_TIMEOUT} seconds."
        exit_code = 124
    except Exception as e:
        stderr_str = str(e)[:MAX_ERROR_LENGTH]
        exit_code = 1
    finally:
        if os.path.exists(tmp_file):
            os.remove(tmp_file)

    # 4. Parse output if test cases were run
    parsed_results = []
    if test_cases and "---TEST_RESULTS---" in stdout_str:
        parts = stdout_str.split("---TEST_RESULTS---")
        stdout_str = parts[0].strip()
        try:
            parsed_results = json.loads(parts[1].strip())
        except:
            pass

    return {
        "stdout": stdout_str,
        "stderr": stderr_str,
        "exit_code": exit_code,
        "test_results": parsed_results
    }
