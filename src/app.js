// Application initialization and main entry point

// Temporary storage for uploaded files (v1.6: dual-track support)
let primaryFile = null;
let secondaryFile = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupFileUpload();
    setupUndoRedoListeners();
    checkForSavedSession();
});

function setupFileUpload() {
    const primaryInput = document.getElementById('fileInput');
    const secondaryInput = document.getElementById('secondaryFileInput');

    // Primary file input
    primaryInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.name.match(/\.(srt|ass)$/i)) {
            primaryFile = file;
            document.getElementById('primaryFilename').textContent = `✓ ${file.name}`;
            updateContinueButton();
        } else if (file) {
            alert('Please select a .srt or .ass file');
        }
    });

    // Secondary file input
    secondaryInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.name.match(/\.(srt|ass)$/i)) {
            secondaryFile = file;
            document.getElementById('secondaryFilename').textContent = `✓ ${file.name}`;
            document.getElementById('clearSecondaryBtn').style.display = 'inline-block';
            updateContinueButton();
        } else if (file) {
            alert('Please select a .srt or .ass file');
        }
    });
}

function updateContinueButton() {
    const continueBtn = document.getElementById('processBothFilesBtn');
    if (primaryFile) {
        continueBtn.style.display = 'inline-block';
    } else {
        continueBtn.style.display = 'none';
    }
}

function clearSecondaryFile() {
    secondaryFile = null;
    document.getElementById('secondaryFileInput').value = '';
    document.getElementById('secondaryFilename').textContent = '';
    document.getElementById('clearSecondaryBtn').style.display = 'none';
}

function processBothFiles() {
    if (!primaryFile) {
        alert('Please select a primary subtitle file');
        return;
    }

    // Read primary file
    const primaryReader = new FileReader();
    primaryReader.onload = (e) => {
        const primaryContent = e.target.result;
        const primaryExtension = primaryFile.name.split('.').pop().toLowerCase();

        appState.filename = primaryFile.name;
        appState.secondaryFilename = secondaryFile ? secondaryFile.name : null;
        appState.hasSecondaryTrack = !!secondaryFile;
        updateFilenameDisplay();

        // Reset filter state
        currentFilter = 'all';
        currentSceneFilter = 'all';

        // Clear undo/redo stacks
        undoStack = [];
        redoStack = [];

        // Check for saved session
        const savedSessionKey = `subtitle-annotation-${primaryFile.name}`;
        const savedSession = localStorage.getItem(savedSessionKey);

        if (savedSession) {
            const loadSaved = confirm(`Found a saved session for "${primaryFile.name}". Would you like to restore your progress?`);
            if (loadSaved) {
                appState = JSON.parse(savedSession);

                // Data migration: Initialize new fields if missing
                if (!appState.sceneBreaks) appState.sceneBreaks = [];
                if (!appState.secondaryFilename) appState.secondaryFilename = null;
                if (!appState.hasSecondaryTrack) appState.hasSecondaryTrack = false;
                if (!appState.secondarySubtitles) appState.secondarySubtitles = [];

                // Migrate subtitle objects to include secondaryText and secondaryIndices fields
                appState.subtitles = appState.subtitles.map(sub => ({
                    ...sub,
                    secondaryText: sub.secondaryText || null,
                    secondaryIndices: sub.secondaryIndices || []
                }));

                updateFilenameDisplay();
                showCharacterManagement();
                return;
            }
        }

        // Check for dual-language ASS (single file with two language styles)
        let dualLanguage = null;
        if (primaryExtension === 'ass' && !secondaryFile) {
            dualLanguage = detectDualLanguageStyles(primaryContent);
        }

        // Parse primary file
        if (primaryExtension === 'srt') {
            appState.subtitles = parseSRT(primaryContent);
        } else if (primaryExtension === 'ass') {
            if (dualLanguage) {
                // Parse only the primary language style
                appState.subtitles = parseASS(primaryContent, [dualLanguage.primary]);
            } else {
                appState.subtitles = parseASS(primaryContent);
            }
        }

        // Handle dual-language ASS: extract secondary track from same file
        if (dualLanguage) {
            const secondarySubtitles = parseASS(primaryContent, [dualLanguage.secondary]);
            appState.secondarySubtitles = secondarySubtitles;
            appState.hasSecondaryTrack = true;
            appState.secondaryFilename = `[${dualLanguage.secondary}]`;
            updateFilenameDisplay();

            // Align secondary to primary
            appState.subtitles = alignSubtitles(appState.subtitles, secondarySubtitles);

            extractCharacters();
            showCharacterManagement();
            return;
        }

        // If secondary file provided, read and align it
        if (secondaryFile) {
            const secondaryReader = new FileReader();
            secondaryReader.onload = (se) => {
                const secondaryContent = se.target.result;
                const secondaryExtension = secondaryFile.name.split('.').pop().toLowerCase();

                // Parse secondary file
                let secondarySubtitles;
                if (secondaryExtension === 'srt') {
                    secondarySubtitles = parseSRT(secondaryContent);
                } else if (secondaryExtension === 'ass') {
                    secondarySubtitles = parseASS(secondaryContent);
                }

                // Store secondary subtitles for manual re-linking
                appState.secondarySubtitles = secondarySubtitles;

                // Align secondary to primary
                appState.subtitles = alignSubtitles(appState.subtitles, secondarySubtitles);

                extractCharacters();
                showCharacterManagement();
            };
            secondaryReader.readAsText(secondaryFile);
        } else {
            // No secondary file - ensure all subtitles have secondaryText/secondaryIndices
            appState.subtitles = appState.subtitles.map(sub => ({
                ...sub,
                secondaryText: null,
                secondaryIndices: []
            }));

            extractCharacters();
            showCharacterManagement();
        }
    };
    primaryReader.readAsText(primaryFile);
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
        let displayName = appState.filename;
        if (appState.secondaryFilename) {
            displayName += ` + ${appState.secondaryFilename}`;
        }
        filenameEl.textContent = displayName;
        currentFileEl.style.display = 'block';
    } else {
        currentFileEl.style.display = 'none';
    }
}

function resetApp() {
    if (confirm('Are you sure you want to start over? Unsaved progress will be lost.')) {
        appState = {
            filename: '',
            secondaryFilename: null,
            subtitles: [],
            characters: [],
            topCharacters: [],
            sceneBreaks: [],
            hasSecondaryTrack: false,
            secondarySubtitles: []
        };

        // Clear file references
        primaryFile = null;
        secondaryFile = null;

        // Clear undo/redo stacks
        undoStack = [];
        redoStack = [];

        updateFilenameDisplay();
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('characterManagement').style.display = 'none';
        document.getElementById('annotationWorkspace').style.display = 'none';
        document.getElementById('fileInput').value = '';
        document.getElementById('secondaryFileInput').value = '';
        document.getElementById('primaryFilename').textContent = '';
        document.getElementById('secondaryFilename').textContent = '';
        document.getElementById('clearSecondaryBtn').style.display = 'none';
        document.getElementById('processBothFilesBtn').style.display = 'none';
    }
}
