// Application initialization and main entry point

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupFileUpload();
    setupUndoRedoListeners();
    checkForSavedSession();
});

function setupFileUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileSelect(file);
    });
}

function handleFileSelect(file) {
    if (!file.name.match(/\.(srt|ass)$/i)) {
        alert('Please select a .srt or .ass file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const extension = file.name.split('.').pop().toLowerCase();

        appState.filename = file.name;
        updateFilenameDisplay();

        // Reset filter state when loading a new file
        currentFilter = 'all';

        // Clear undo/redo stacks when loading a new file
        undoStack = [];
        redoStack = [];

        // Check for saved session
        const savedSessionKey = `subtitle-annotation-${file.name}`;
        const savedSession = localStorage.getItem(savedSessionKey);

        if (savedSession) {
            const loadSaved = confirm(`Found a saved session for "${file.name}". Would you like to restore your progress?`);
            if (loadSaved) {
                appState = JSON.parse(savedSession);

                // Data migration: Initialize sceneBreaks if missing (for older saved sessions)
                if (!appState.sceneBreaks) {
                    appState.sceneBreaks = [];
                }

                updateFilenameDisplay();
                showCharacterManagement();
                return;
            }
        }

        // No saved session or user declined - parse fresh
        if (extension === 'srt') {
            appState.subtitles = parseSRT(content);
        } else if (extension === 'ass') {
            appState.subtitles = parseASS(content);
        }

        extractCharacters();
        showCharacterManagement();
    };
    reader.readAsText(file);
}

function setupUndoRedoListeners() {
    // Setup global keyboard listener for undo/redo
    document.addEventListener('keydown', (e) => {
        // Check for Ctrl+Z (undo)
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            // Don't trigger if user is typing in an input field
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;

            e.preventDefault();
            if (performUndo()) {
                console.log('Undo performed');
            }
        }

        // Check for Ctrl+Y or Ctrl+Shift+Z (redo)
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            // Don't trigger if user is typing in an input field
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;

            e.preventDefault();
            if (performRedo()) {
                console.log('Redo performed');
            }
        }
    });
}

function updateFilenameDisplay() {
    const currentFileEl = document.getElementById('currentFile');
    const filenameEl = document.getElementById('filename');

    if (appState.filename) {
        filenameEl.textContent = appState.filename;
        currentFileEl.style.display = 'block';
    } else {
        currentFileEl.style.display = 'none';
    }
}

function resetApp() {
    if (confirm('Are you sure you want to start over? Unsaved progress will be lost.')) {
        appState = {
            filename: '',
            subtitles: [],
            characters: [],
            topCharacters: [],
            sceneBreaks: []
        };

        // Clear undo/redo stacks
        undoStack = [];
        redoStack = [];

        updateFilenameDisplay();
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('characterManagement').style.display = 'none';
        document.getElementById('annotationWorkspace').style.display = 'none';
        document.getElementById('fileInput').value = '';
    }
}
