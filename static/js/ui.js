// UI Helpers for CodeMentor AI

// Configure marked with highlight.js
marked.setOptions({
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (__) { }
        }
        return code; // use external default escaping
    }
});

// Loading Overlay
function showLoading(message = "Loading...") {
    document.getElementById('loading-message').textContent = message;
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// View Management
const views = ['view-setup', 'view-assessment', 'view-dashboard', 'view-learning'];

function showView(viewId) {
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
            if (v === viewId) {
                el.classList.remove('hidden');
                el.classList.add('animate-fade-in');
            } else {
                el.classList.add('hidden');
                el.classList.remove('animate-fade-in');
            }
        }
    });

    // special handling for learning view to resize editor
    if (viewId === 'view-learning' && window.editor) {
        setTimeout(() => window.editor.layout(), 100);
    }
}

// Navbar Info
function updateNavbar(progress) {
    if (progress && progress.student_id) {
        document.getElementById('nav-user-info').classList.remove('hidden');
        document.getElementById('nav-name').textContent = progress.name;
        document.getElementById('streak-count').textContent = progress.streak_days;

        const levelEl = document.getElementById('nav-level');
        levelEl.textContent = progress.level || "Assessing";

        // Color based on level
        levelEl.className = 'px-2 py-1 rounded text-xs capitalize text-white ';
        if (progress.level === 'advanced') levelEl.className += 'bg-red-600';
        else if (progress.level === 'intermediate') levelEl.className += 'bg-purple-600';
        else levelEl.className += 'bg-green-600';
    } else {
        document.getElementById('nav-user-info').classList.add('hidden');
    }
}

// Tabs in Learning View
function switchTab(tabId) {
    const tabs = ['tutorial', 'problem', 'review'];
    tabs.forEach(t => {
        // Tab buttons
        const btn = document.getElementById(`tab-${t}`);
        if (t === tabId) {
            btn.classList.add('border-blue-500', 'text-blue-400');
            btn.classList.remove('border-transparent', 'text-gray-400');
        } else {
            btn.classList.remove('border-blue-500', 'text-blue-400');
            btn.classList.add('border-transparent', 'text-gray-400');
        }

        // Panels
        const panel = document.getElementById(`panel-${t}`);
        if (t === tabId) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });
}

// Markdown rendering helper
function renderMarkdown(elId, mdString) {
    const el = document.getElementById(elId);
    if (el && mdString) {
        el.innerHTML = marked.parse(mdString);
    }
}

// Terminal Output Helper
function writeToTerminal(output, isError = false) {
    const term = document.getElementById('terminal-output');
    if (!output) output = '(No output)';

    // Simple sanitization
    output = output.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (isError) {
        term.innerHTML = `<span class="text-red-400">${output}</span>`;
    } else {
        term.innerHTML = `<span class="text-green-300">${output}</span>`;
    }
    term.scrollTop = term.scrollHeight;
}
