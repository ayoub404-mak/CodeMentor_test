// Main App State & Logic

let state = {
    progress: null,
    currentProblemData: null,
    hasPassedCurrent: false
};

// Initialization 
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const status = await api.getStatus();
        if (status.configured) {
            await loadProgressAndRoute();
        } else {
            showView('view-setup');
        }
    } catch (e) {
        console.error("Startup error:", e);
        showView('view-setup');
    }

    setupEventListeners();
});

function setupEventListeners() {
    // Setup Form
    document.getElementById('setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('setup-name').value;
        const providerRadio = document.querySelector('input[name="provider"]:checked');
        const provider = providerRadio ? providerRadio.value : 'mistral';
        const apiKey = document.getElementById('setup-key').value;

        try {
            await api.setup(name, provider, apiKey);
            await startAssessment();
        } catch (err) {
            alert(`Setup failed: ${err.message}`);
        }
    });

    // Assessment Submit
    document.getElementById('btn-submit-assessment').addEventListener('click', async () => {
        const mcqAnswers = [];
        const mcqSelects = document.querySelectorAll('.mcq-select');
        mcqSelects.forEach((select, i) => {
            mcqAnswers.push({ question_index: i, answer: select.value });
        });

        const codingSolutions = [];
        const codingTextareas = document.querySelectorAll('.coding-answer');
        codingTextareas.forEach((ta, i) => {
            codingSolutions.push({ challenge_index: i, code: ta.value });
        });

        try {
            showLoading("Evaluating Assessment...");
            await api.evaluateAssessment({ mcq_answers: mcqAnswers, coding_solutions: codingSolutions });
            await loadProgressAndRoute();
        } catch (err) {
            alert(`Evaluation failed: ${err.message}`);
        }
    });

    // Dashboard Continue
    document.getElementById('btn-continue-learning').addEventListener('click', () => {
        loadLearningView();
    });

    // Editor Tabs
    document.getElementById('tab-tutorial').addEventListener('click', () => switchTab('tutorial'));
    document.getElementById('tab-problem').addEventListener('click', () => switchTab('problem'));
    document.getElementById('tab-review').addEventListener('click', () => switchTab('review'));

    // Code Runner Buttons
    document.getElementById('btn-run').addEventListener('click', async () => {
        const code = getEditorContent();
        document.getElementById('btn-next-step').classList.add('hidden');
        try {
            writeToTerminal("Running code...\n");
            const res = await api.runCode(code);
            let out = '';
            if (res.stdout) out += res.stdout + '\n';
            if (res.stderr) out += res.stderr + '\n';
            out += `\nProcess exited with code ${res.exit_code}`;
            writeToTerminal(out, res.exit_code !== 0);
        } catch (err) {
            writeToTerminal(`Error: ${err.message}`, true);
        }
    });

    document.getElementById('btn-submit').addEventListener('click', async () => {
        const code = getEditorContent();
        const tests = state.currentProblemData ? state.currentProblemData.test_cases : [];
        document.getElementById('btn-next-step').classList.add('hidden');

        try {
            writeToTerminal("Running tests...\n");
            const res = await api.submitCode(code, tests);

            let out = '';
            if (res.stderr) out += res.stderr + '\n';
            if (res.stdout) out += res.stdout + '\n';
            out += `\nProcess exited with code ${res.exit_code}\n`;

            let passedCount = 0;
            let failedDetails = "";
            let totalCount = 0;

            if (res.test_results && res.test_results.length > 0) {
                totalCount = res.test_results.length;
                res.test_results.forEach((t, i) => {
                    const status = t.passed ? "✅ PASS" : "❌ FAIL";
                    if (t.passed) passedCount++;
                    else failedDetails += `Test ${i+1} failed. Input: ${t.input}. Expected: ${t.expected}. Actual: ${t.actual}. `;
                    out += `${document.getElementById('problem-tests').children[i].innerText} -> ${status}\n`;
                });
                out += `\n${passedCount}/${totalCount} tests passed.\n`;
            }
            writeToTerminal(out, res.exit_code !== 0 || passedCount < totalCount);

            // Fetch Review if there were tests
            if (totalCount > 0) {
                writeToTerminal("Fetching AI review...\n");
                switchTab('review');
                document.getElementById('review-content').innerHTML = `
                    <div class="flex items-center gap-2 text-blue-400 mb-4">
                        <i data-lucide="loader-2" class="animate-spin w-5 h-5"></i> AI is analyzing your code...
                    </div>
                `;

                const reviewRes = await api.reviewCode(
                    code,
                    state.currentProblemData ? state.currentProblemData.description : "Unknown",
                    passedCount,
                    totalCount,
                    failedDetails
                );

                renderReview(reviewRes.feedback, passedCount === totalCount);
                if (passedCount === totalCount) {
                    state.hasPassedCurrent = true;
                    document.getElementById('btn-next-step').classList.remove('hidden');

                    // Fire confetti effect or animation here
                    document.getElementById('dash-solved').classList.add('text-green-400');
                    setTimeout(() => document.getElementById('dash-solved').classList.remove('text-green-400'), 1000);

                    // Update local progress ref
                    state.progress.total_problems_solved = (state.progress.total_problems_solved || 0) + 1;
                    document.getElementById('dash-solved').innerText = state.progress.total_problems_solved;
                }
            }

        } catch (err) {
            writeToTerminal(`Error: ${err.message}\n`, true);
        }
    });

    document.getElementById('btn-hint').addEventListener('click', async () => {
        const code = getEditorContent();
        const problem = state.currentProblemData ? state.currentProblemData.description : "Unknown";
        try {
            const res = await api.getHint(code, problem);
            document.getElementById('hint-content').innerText = `"${res.hint}"`;
            document.getElementById('hint-modal').classList.remove('hidden');
        } catch (err) {
            alert(`Could not fetch hint: ${err.message}`);
        }
    });

    document.getElementById('btn-close-hint').addEventListener('click', () => {
        document.getElementById('hint-modal').classList.add('hidden');
    });

    document.getElementById('btn-next-step').addEventListener('click', async () => {
        // Attempt to load next problem or topic
        // For MVP, we will assume each topic has 3 problems, then we move to next topic
        state.progress.current_problem_index = (state.progress.current_problem_index || 0) + 1;

        if (state.progress.current_problem_index >= 3) {
            // Next topic
            try {
                const nextRes = await api.nextTopic();
                alert(`Topic Complete! Moving to: ${nextRes.next_topic.replace('_', ' ')}`);
                await loadProgressAndRoute(); // Routes back to dashboard/learning
            } catch (e) { alert(e.message); }
        } else {
            // Next problem in same topic
            await loadLearningView();
            switchTab('problem');
            document.getElementById('btn-next-step').classList.add('hidden');
        }
    });
}

// Routing & Flow

async function loadProgressAndRoute() {
    try {
        state.progress = await api.getProgress();
        updateNavbar(state.progress);

        if (!state.progress.level) {
            // Need assessment
            await startAssessment();
        } else {
            // Render Dashboard
            renderDashboard();
            showView('view-dashboard');
        }
    } catch (err) {
        console.error("Progress routing error:", err);
        showView('view-setup');
    }
}

async function startAssessment() {
    showLoading("Generating Placement Assessment...");
    try {
        const exam = await api.generateAssessment();
        renderAssessment(exam);
        showView('view-assessment');
    } catch (err) {
        alert("Failed to load assessment. Check API key and try again.");
    }
}

function renderAssessment(exam) {
    const container = document.getElementById('assessment-content');
    container.innerHTML = '';

    // MCQs
    if (exam.mcq_questions) {
        exam.mcq_questions.forEach((q, i) => {
            let html = `
                <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 class="text-white font-medium mb-3"><span class="text-gray-400">Q${i+1}:</span> ${q.question}</h3>
            `;
            if (q.code_snippet) {
                html += `<pre class="bg-gray-900 border border-gray-700 rounded p-3 mb-4 text-sm font-mono text-gray-300"><code>${q.code_snippet}</code></pre>`;
            }
            html += `
                    <select class="w-full bg-gray-900 border border-gray-700 text-white p-2 rounded mcq-select">
                        <option value="">Select an answer...</option>
            `;
            q.options.forEach(opt => {
                html += `<option value="${opt}">${opt}</option>`;
            });
            html += `</select></div>`;
            container.innerHTML += html;
        });
    }

    // Coding
    if (exam.coding_challenges) {
        exam.coding_challenges.forEach((c, i) => {
            container.innerHTML += `
                <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 class="text-white font-medium mb-2"><span class="text-purple-400">Coding ${i+1}:</span> ${c.title}</h3>
                    <p class="text-gray-400 text-sm mb-4">${c.description}</p>
                    <textarea class="w-full h-32 bg-gray-900 border border-gray-700 text-gray-300 p-3 rounded font-mono text-sm coding-answer" placeholder="Write your code here...">${c.starter_code || ''}</textarea>
                </div>
            `;
        });
    }
}

function renderDashboard() {
    const p = state.progress;
    document.getElementById('dash-level').textContent = p.level;
    document.getElementById('dash-solved').textContent = p.total_problems_solved || 0;
    document.getElementById('dash-next-topic').textContent = (p.current_topic || "Done").replace('_', ' ');

    const pathContainer = document.getElementById('learning-path-visual');
    pathContainer.innerHTML = '';

    // Build completed nodes
    const completed = p.completed_topics || [];
    completed.forEach(t => {
        pathContainer.innerHTML += `
            <div class="px-3 py-1 bg-green-900/40 border border-green-800 text-green-300 rounded flex items-center gap-2">
                <i data-lucide="check-circle" class="w-4 h-4"></i> ${t.replace('_', ' ')}
            </div>
            <div class="text-gray-600 self-center">→</div>
        `;
    });

    // Current node
    if (p.current_topic && p.current_topic !== 'course_completed') {
        pathContainer.innerHTML += `
            <div class="px-3 py-1 bg-blue-900/60 border border-blue-500 text-blue-200 rounded font-bold shadow-[0_0_10px_rgba(59,130,246,0.5)] flex items-center gap-2">
                <i data-lucide="target" class="w-4 h-4 text-blue-400"></i> ${p.current_topic.replace('_', ' ')}
            </div>
        `;
    } else {
        pathContainer.innerHTML += `
            <div class="px-3 py-1 bg-purple-900/60 border border-purple-500 text-purple-200 rounded font-bold">
                Course Completed!
            </div>
        `;
    }
    lucide.createIcons();
}

async function loadLearningView() {
    showView('view-learning');
    initEditor();
    state.hasPassedCurrent = false;
    document.getElementById('btn-next-step').classList.add('hidden');

    writeToTerminal("Initializing workspace...\n");

    const topic = state.progress.current_topic;
    if (!topic || topic === 'course_completed') {
        alert("Course Completed! Reset progress to start over.");
        return;
    }

    try {
        // Load Tutorial
        const tutRes = await api.getTutorial(topic);
        renderMarkdown('panel-tutorial', tutRes.content);
        switchTab('tutorial');

        // Load Problem
        const pIndex = state.progress.current_problem_index || 0;
        const lastProb = state.currentProblemData ? state.currentProblemData.description : "";
        const probRes = await api.getProblem(topic, pIndex, lastProb);

        state.currentProblemData = probRes;

        document.getElementById('problem-title').textContent = probRes.title;
        document.getElementById('problem-difficulty').textContent = probRes.difficulty || "Medium";
        renderMarkdown('problem-desc', probRes.description);

        if (probRes.builds_on) {
            const buildsEl = document.getElementById('problem-builds-on');
            buildsEl.textContent = "Builds on: " + probRes.builds_on;
            buildsEl.classList.remove('hidden');
        } else {
            document.getElementById('problem-builds-on').classList.add('hidden');
        }

        const testsContainer = document.getElementById('problem-tests');
        testsContainer.innerHTML = '';
        if (probRes.test_cases) {
            probRes.test_cases.forEach((t, i) => {
                testsContainer.innerHTML += `
                    <div class="flex justify-between bg-gray-800 p-2 rounded text-gray-300">
                        <span>Test ${i+1}: <code>${t.input}</code></span>
                        <span class="text-gray-500">→ ${t.expected}</span>
                    </div>
                `;
            });
        }

        setEditorContent(probRes.starter_code || "# Write your code here\n");
        document.getElementById('review-content').innerHTML = `
            <p class="text-gray-400 italic">Submit your code to get AI feedback.</p>
        `;

        writeToTerminal("Workspace ready.\n");

    } catch (err) {
        alert("Failed to load topic content: " + err.message);
    }
}

function renderReview(feedback, passedAll) {
    if (!feedback) {
        document.getElementById('review-content').innerHTML = `<p class="text-red-400">Failed to load AI review.</p>`;
        return;
    }

    let html = '';

    if (passedAll) {
        html += `
            <div class="bg-green-900/30 border border-green-800 p-4 rounded-lg mb-6 text-center">
                <i data-lucide="check-circle" class="w-12 h-12 text-green-500 mx-auto mb-2"></i>
                <h3 class="text-xl font-bold text-green-400 mb-1">Great Job!</h3>
                <p class="text-green-300">${feedback.encouragement || 'You passed all tests!'}</p>
            </div>
        `;
    } else {
        html += `
            <div class="bg-yellow-900/30 border border-yellow-800 p-4 rounded-lg mb-6">
                <div class="flex items-center gap-2 text-yellow-500 mb-2">
                    <i data-lucide="alert-triangle" class="w-5 h-5"></i>
                    <h3 class="font-bold">Not quite right yet</h3>
                </div>
                <p class="text-yellow-300/80 text-sm">${feedback.encouragement || 'Keep trying, you are close!'}</p>
            </div>
        `;
    }

    const sections = [
        { title: 'Strengths', icon: 'thumbs-up', content: feedback.strengths, color: 'text-blue-400' },
        { title: 'Bugs Overview', icon: 'bug', content: feedback.bugs, color: 'text-red-400', hideOnPass: true },
        { title: 'Optimization Idea', icon: 'zap', content: feedback.optimization, color: 'text-purple-400' },
        { title: 'Pythonic Tip', icon: 'star', content: feedback.best_practice, color: 'text-yellow-400' },
        { title: 'Progress Note', icon: 'trending-up', content: feedback.progress_note, color: 'text-green-400' }
    ];

    sections.forEach(s => {
        if (s.content && (!s.hideOnPass || !passedAll)) {
            html += `
                <div class="mb-5 last:mb-0">
                    <div class="flex items-center gap-2 ${s.color} mb-2">
                        <i data-lucide="${s.icon}" class="w-4 h-4"></i>
                        <h4 class="font-bold uppercase tracking-wider text-xs">${s.title}</h4>
                    </div>
                    <div class="text-sm text-gray-300 ml-6 markdown-body bg-gray-900 border border-gray-700 p-3 rounded-lg leading-relaxed">
                        ${marked.parse(s.content)}
                    </div>
                </div>
            `;
        }
    });

    document.getElementById('review-content').innerHTML = html;
    lucide.createIcons(); // Re-render icons for dynamic content
}
