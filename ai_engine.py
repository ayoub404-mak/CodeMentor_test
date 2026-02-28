import json
import os
from config import AI_PROVIDER, MISTRAL_API_KEY, GEMINI_API_KEY

class AIEngine:
    def __init__(self):
        self.provider = AI_PROVIDER
        self.init_client()

    def init_client(self):
        self.client = None
        if self.provider == "mistral":
            key = os.getenv("MISTRAL_API_KEY", MISTRAL_API_KEY)
            if not key:
                print("Warning: MISTRAL_API_KEY not set")
            else:
                try:
                    from mistralai import Mistral
                    self.client = Mistral(api_key=key)
                except ImportError:
                    print("Mistral SDK not installed")
        elif self.provider == "gemini":
            key = os.getenv("GEMINI_API_KEY", GEMINI_API_KEY)
            if not key:
                print("Warning: GEMINI_API_KEY not set")
            else:
                try:
                    from google import genai
                    self.client = genai.Client(api_key=key)
                except ImportError:
                    print("Google GenAI SDK not installed")
    
    def set_provider_and_key(self, provider: str, api_key: str):
        self.provider = provider
        if provider == "mistral":
            os.environ["MISTRAL_API_KEY"] = api_key
        elif provider == "gemini":
            os.environ["GEMINI_API_KEY"] = api_key
        self.init_client()
    
    def generate_json(self, prompt: str) -> dict:
        """Call the AI provider and return a parsed JSON response."""
        response_text = "{}"
        if self.provider == "mistral":
            try:
                response = self.client.chat.complete(
                    model="mistral-large-latest",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}
                )
                response_text = response.choices[0].message.content
            except Exception as e:
                print(f"Mistral API Error: {e}")
                return {}
        elif self.provider == "gemini":
            try:
                 response = self.client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                 )
                 response_text = response.text
                 # cleanup markdown json block if present
                 if response_text.startswith("```json"):
                     response_text = response_text[7:-3]
            except Exception as e:
                 print(f"Gemini API Error: {e}")
                 return {}
        
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            print(f"Failed to decode JSON: {response_text}")
            return {}

    def generate_assessment(self) -> dict:
        prompt = """
        You are an expert Python programming assessor. Generate a placement exam to 
        determine a student's coding level. Return valid JSON only:
        {
        "mcq_questions": [
            {
            "question": "...",
            "code_snippet": "...",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct": "B",
            "topic": "loops",
            "difficulty": "medium"
            }
        ],
        "coding_challenges": [
            {
            "title": "...",
            "description": "...",
            "starter_code": "...",
            "test_cases": [{"input": "...", "expected": "..."}],
            "difficulty": "medium"
            }
        ]
        }
        Generate 6 MCQ (2 easy, 2 medium, 2 hard) covering: variables, loops, 
        functions, lists, dictionaries, recursion, sorting, OOP basics.
        Generate 2 coding challenges (1 medium, 1 hard).
        """
        return self.generate_json(prompt)

    def evaluate_assessment(self, results_json: dict) -> dict:
        prompt = f"""
        Based on this student's assessment results, determine their level and 
        create a personalized learning path.

        Assessment Results: {json.dumps(results_json)}

        Return valid JSON only format EXACTLY like this:
        {{
        "level": "beginner|intermediate|advanced",
        "score": 65,
        "analysis": "Strong in basics...",
        "strengths": ["loops"],
        "weaknesses": ["recursion"],
        "learning_path": [
            {{"topic": "dictionaries", "reason": "Strengthen weak area"}},
            {{"topic": "stacks_queues", "reason": "New data structure"}}
        ]
        }}
        """
        return self.generate_json(prompt)

    def generate_tutorial(self, topic: str, level: str, completed_topics: list) -> str:
        prompt = f"""
        Generate a tutorial for the topic "{topic}" in Python. 
        The student's level is {level}. They have already completed: {completed_topics}.

        Build on their existing knowledge. Don't re-explain what they already know.
        Focus on what is NEW in this topic.

        Include:
        - A real-world analogy that makes the concept click
        - 2–3 code examples with inline comments (progressively complex)
        - Common mistakes beginners make with this concept
        - 3 key takeaways

        Format as clean Markdown with code blocks. Keep it 300–500 words.
        Be encouraging but concise.
        Return ONLY valid JSON:
        {{
            "content": "markdown tutorial content here"
        }}
        """
        res = self.generate_json(prompt)
        return res.get("content", f"Error generating tutorial for {topic}")

    def generate_problem(self, topic: str, level: str, completed_problems: int, last_problem: str, strengths: list, weaknesses: list) -> dict:
        prompt = f"""
        You are generating the NEXT coding problem for a student.

        Context:
        - Current topic: {topic}
        - Student level: {level}
        - Problems completed in this topic: {completed_problems}
        - Previous problem: {last_problem}
        - Known strengths: {strengths}
        - Known weaknesses: {weaknesses}

        Generate a problem that:
        1. Builds on what they just solved
        2. If they struggled, give a reinforcement problem
        3. Include real-world context (not abstract math)

        Return valid JSON only format EXACTLY like this:
        {{
        "title": "...",
        "description": "...", 
        "builds_on": "Extends the previous problem by adding...",
        "concepts_tested": ["concept1", "concept2"],
        "starter_code": "def func(params):\\n    pass",
        "test_cases": [
            {{"input": "func('hello')", "expected": "{{'h': 1, 'e': 1, 'l': 2, 'o': 1}}" }}
        ],
        "difficulty": "medium",
        "hints": [
            "Think about..."
        ]
        }}
        """
        return self.generate_json(prompt)

    def review_code(self, level: str, topic: str, problem_desc: str, code: str, passed: int, total: int, failed_details: str) -> dict:
        prompt = f"""
        You are a senior Python engineer mentoring a student.

        **Student Level:** {level}
        **Topic:** {topic}
        **Problem:** {problem_desc}
        **Student's Code:**
        ```python
        {code}
        ```
        **Test Results:** {passed}/{total} passed
        **Failed Tests:** {failed_details}

        Provide structured feedback as JSON EXACTLY like this:
        {{
        "strengths": "What they did well — be specific, reference their actual code",
        "bugs": "Explain bugs simply, suggest the fix without giving full solution",
        "optimization": "Show a better approach with a small code snippet",
        "best_practice": "One Python-specific industry tip",
        "progress_note": "Compare to their previous submissions if available",
        "encouragement": "A short motivating message"
        }}
        """
        return self.generate_json(prompt)

    def generate_hint(self, code: str, problem: str) -> dict:
        prompt = f"""
        A student is stuck on '{problem}'.
        Their current code is:
        ```python
        {code}
        ```
        Instead of giving the answer, ask a guiding question (Socratic method).
        Return JSON EXACTLY:
        {{
            "hint": "Your question here..."
        }}
        """
        return self.generate_json(prompt)

ai_engine_instance = AIEngine()
