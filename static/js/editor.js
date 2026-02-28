// Monaco Editor Initialization and Setup

window.editor = null;

function initEditor() {
    if (window.editor) return; // already initialized

    // Require Monaco from CDN (configured in index.html)
    require(['vs/editor/editor.main'], function () {

        window.editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: '# Write your code here\n',
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            scrollBeyondLastLine: false,
            roundedSelection: false,
            padding: { top: 16 }
        });

        // Add custom theme matching our tailwind colors
        monaco.editor.defineTheme('codementor-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#1e1e1e',
                'editor.lineHighlightBackground': '#2d2d2d'
            }
        });
        monaco.editor.setTheme('codementor-dark');
    });
}

function setEditorContent(code) {
    if (window.editor) {
        window.editor.setValue(code);
    }
}

function getEditorContent() {
    if (window.editor) {
        return window.editor.getValue();
    }
    return "";
}
