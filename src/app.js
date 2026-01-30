// Application initialization and main entry point

// Temporary storage for uploaded files (v1.6: dual-track support)
let primaryFile = null;
let secondaryFile = null;

// Temporary storage for dual-language modal callback
let pendingSecondaryContent = null;
let pendingDualLanguageInfo = null;

// Language code display names
const langDisplayNames = {
    ja: 'Japanese', en: 'English', zh: 'Chinese', ko: 'Korean',
    fr: 'French', de: 'German', es: 'Spanish', pt: 'Portuguese',
    it: 'Italian', ru: 'Russian'
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupFileUpload();
    setupUndoRedoListeners();
    renderSessionPicker();
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
                migrateAppState();

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

                // Check if secondary ASS file is dual-language
                if (secondaryExtension === 'ass') {
                    const dualLang = detectDualLanguageStyles(secondaryContent);
                    if (dualLang) {
                        // Store content and show selection modal
                        pendingSecondaryContent = secondaryContent;
                        pendingDualLanguageInfo = dualLang;
                        showDualLanguageModal(dualLang);
                        return;
                    }
                }

                // Parse secondary file (single-language path)
                let secondarySubtitles;
                if (secondaryExtension === 'srt') {
                    secondarySubtitles = parseSRT(secondaryContent);
                } else if (secondaryExtension === 'ass') {
                    secondarySubtitles = parseASS(secondaryContent);
                }

                finishSecondaryProcessing(secondarySubtitles);
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

// Shared continuation for secondary file processing (used by both direct path and modal callback)
function finishSecondaryProcessing(secondarySubtitles) {
    appState.secondarySubtitles = secondarySubtitles;
    appState.subtitles = alignSubtitles(appState.subtitles, secondarySubtitles);
    extractCharacters();
    showCharacterManagement();
}

// Dual-language track selection modal
function showDualLanguageModal(dualLang) {
    const modal = document.getElementById('dualLanguageModal');
    const optionsDiv = document.getElementById('dualLanguageOptions');

    // Extract language code from the suffixed style name
    const langMatch = dualLang.secondary.match(/-(ja|en|zh|ko|fr|de|es|pt|it|ru)$/i);
    const langCode = langMatch ? langMatch[1].toLowerCase() : null;
    const langName = langCode ? (langDisplayNames[langCode] || langCode.toUpperCase()) : 'Secondary';

    // Determine which label is which: the base style is the "other" language
    // For a file with "Default" + "Default-ja", Default is typically English and Default-ja is Japanese
    const baseLabel = langCode === 'en' ? langName : 'English';
    const suffixLabel = langCode === 'en' ? 'English' : langName;

    // If we can't determine the base language reliably, just use the style names
    const baseName = dualLang.primary;
    const suffixName = dualLang.secondary;

    optionsDiv.innerHTML = `
        <label style="display: block; margin-bottom: 12px; padding: 10px; background: rgba(52, 152, 219, 0.05); border: 1px solid rgba(52, 152, 219, 0.2); border-radius: 4px; cursor: pointer;">
            <input type="radio" name="dualLangChoice" value="primary" checked style="margin-right: 8px;">
            <strong>${baseName}</strong> <span style="color: #6c757d;">(base style — typically ${baseLabel})</span>
        </label>
        <label style="display: block; margin-bottom: 12px; padding: 10px; background: rgba(52, 152, 219, 0.05); border: 1px solid rgba(52, 152, 219, 0.2); border-radius: 4px; cursor: pointer;">
            <input type="radio" name="dualLangChoice" value="secondary" style="margin-right: 8px;">
            <strong>${suffixName}</strong> <span style="color: #6c757d;">(${suffixLabel})</span>
        </label>
        <label style="display: block; padding: 10px; background: rgba(149, 165, 166, 0.05); border: 1px solid rgba(149, 165, 166, 0.2); border-radius: 4px; cursor: pointer;">
            <input type="radio" name="dualLangChoice" value="both" style="margin-right: 8px;">
            <strong>Both tracks combined</strong> <span style="color: #6c757d;">(all dialogue lines concatenated)</span>
        </label>
    `;

    modal.style.display = 'flex';
}

function closeDualLanguageModal() {
    document.getElementById('dualLanguageModal').style.display = 'none';
    pendingSecondaryContent = null;
    pendingDualLanguageInfo = null;
    // Processing was interrupted mid-way (primary parsed but secondary not finished).
    // Reset state so the user can try again from the upload screen.
    appState.filename = '';
    appState.secondaryFilename = null;
    appState.hasSecondaryTrack = false;
    appState.subtitles = [];
    updateFilenameDisplay();
}

function confirmDualLanguageChoice() {
    const choice = document.querySelector('input[name="dualLangChoice"]:checked').value;
    const content = pendingSecondaryContent;
    const dualLang = pendingDualLanguageInfo;

    // Close modal and clear pending state
    document.getElementById('dualLanguageModal').style.display = 'none';

    let secondarySubtitles;
    let trackLabel;

    if (choice === 'primary') {
        secondarySubtitles = parseASS(content, [dualLang.primary]);
        trackLabel = dualLang.primary;
    } else if (choice === 'secondary') {
        secondarySubtitles = parseASS(content, [dualLang.secondary]);
        trackLabel = dualLang.secondary;
    } else {
        // 'both' - parse without style filter (original behavior)
        secondarySubtitles = parseASS(content);
        trackLabel = `${dualLang.primary}+${dualLang.secondary}`;
    }

    // Update the secondary filename to indicate which track was chosen
    appState.secondaryFilename = `${secondaryFile.name} [${trackLabel}]`;
    updateFilenameDisplay();

    pendingSecondaryContent = null;
    pendingDualLanguageInfo = null;

    finishSecondaryProcessing(secondarySubtitles);
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
            secondarySubtitles: [],
            lastSaved: null
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
        document.getElementById('importProjectInput').value = '';
        renderSessionPicker();
    }
}
