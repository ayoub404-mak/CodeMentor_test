// API fetch wrappers

async function apiRequest(endpoint, options = {}) {
    showLoading();
    try {
        const response = await fetch(endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || data.message || `Request failed with status ${response.status}`);
        }
        return data;
    } catch (err) {
        console.error(`API Error on ${endpoint}:`, err);
        throw err;
    } finally {
        hideLoading();
    }
}

const api = {
    getStatus: () => apiRequest('/api/status'),
    setup: (name, provider, apiKey) => apiRequest('/api/setup', {
        method: 'POST',
        body: JSON.stringify({ name, provider, api_key: apiKey })
    }),
    generateAssessment: () => apiRequest('/api/assessment/generate', { method: 'POST' }),
    evaluateAssessment: (answers) => apiRequest('/api/assessment/evaluate', {
        method: 'POST',
        body: JSON.stringify(answers)
    }),
    getProgress: () => apiRequest('/api/progress'),
    getTutorial: (topic) => apiRequest('/api/tutorial', {
        method: 'POST',
        body: JSON.stringify({ topic })
    }),
    getProblem: (topic, index, lastProblem = "") => apiRequest('/api/problem/generate', {
        method: 'POST',
        body: JSON.stringify({ topic, problem_index: index, last_problem: lastProblem })
    }),
    runCode: (code) => apiRequest('/api/code/run', {
        method: 'POST',
        body: JSON.stringify({ code })
    }),
    submitCode: (code, testCases) => apiRequest('/api/code/submit', {
        method: 'POST',
        body: JSON.stringify({ code, test_cases: testCases })
    }),
    reviewCode: (code, problem, passed, total, failedDetails) => apiRequest('/api/review', {
        method: 'POST',
        body: JSON.stringify({ code, problem, passed, total, failed_details: failedDetails })
    }),
    getHint: (code, problem, level = 1) => apiRequest('/api/hint', {
        method: 'POST',
        body: JSON.stringify({ code, problem, hint_level: level })
    }),
    nextTopic: () => apiRequest('/api/topic/next', { method: 'POST' })
};
