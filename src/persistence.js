// localStorage persistence and session management functions

function saveToLocalStorage() {
    appState.lastSaved = new Date().toISOString();
    const key = `subtitle-annotation-${appState.filename}`;
    try {
        localStorage.setItem(key, JSON.stringify(appState));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            alert('localStorage is full. Consider deleting old sessions or using "Save Project" to export to a file.');
        }
    }
}

// Data migration: ensure backward compatibility when loading older saved states
function migrateAppState() {
    if (!appState.sceneBreaks) appState.sceneBreaks = [];
    if (!appState.secondaryFilename) appState.secondaryFilename = null;
    if (!appState.hasSecondaryTrack) appState.hasSecondaryTrack = false;
    if (!appState.secondarySubtitles) appState.secondarySubtitles = [];
    if (!appState.lastSaved) appState.lastSaved = null;

    appState.subtitles = appState.subtitles.map(sub => ({
        ...sub,
        secondaryText: sub.secondaryText || null,
        secondaryIndices: sub.secondaryIndices || []
    }));
}

// --- Session Picker (upload screen) ---

function renderSessionPicker() {
    const container = document.getElementById('sessionPickerContainer');
    if (!container) return;

    const savedKeys = Object.keys(localStorage).filter(
        key => key.startsWith('subtitle-annotation-')
    );

    if (savedKeys.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Parse metadata from each saved session
    const sessions = savedKeys.map(key => {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            const totalLines = data.subtitles ? data.subtitles.length : 0;
            const annotatedLines = data.subtitles
                ? data.subtitles.filter(s => s.character).length : 0;
            const pct = totalLines > 0
                ? Math.round((annotatedLines / totalLines) * 100) : 0;
            return {
                key,
                filename: data.filename || key.replace('subtitle-annotation-', ''),
                secondaryFilename: data.secondaryFilename || null,
                totalLines,
                annotatedLines,
                pct,
                lastSaved: data.lastSaved || null
            };
        } catch (e) {
            return {
                key,
                filename: key.replace('subtitle-annotation-', ''),
                secondaryFilename: null,
                totalLines: 0,
                annotatedLines: 0,
                pct: 0,
                lastSaved: null,
                parseError: true
            };
        }
    });

    // Sort by most recently saved (nulls last)
    sessions.sort((a, b) => {
        if (!a.lastSaved && !b.lastSaved) return 0;
        if (!a.lastSaved) return 1;
        if (!b.lastSaved) return -1;
        return new Date(b.lastSaved) - new Date(a.lastSaved);
    });

    // Build DOM (avoid innerHTML with raw filenames for XSS safety)
    container.style.display = 'block';
    container.innerHTML = '';

    const heading = document.createElement('h3');
    heading.textContent = 'Saved Sessions';
    container.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'session-list';

    sessions.forEach(s => {
        const card = document.createElement('div');
        card.className = 'session-card';
        card.addEventListener('click', () => restoreSession(s.key));

        const info = document.createElement('div');
        info.className = 'session-card-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'session-filename';
        let displayName = s.filename;
        if (s.secondaryFilename) displayName += ` + ${s.secondaryFilename}`;
        nameEl.textContent = displayName;

        const metaEl = document.createElement('div');
        metaEl.className = 'session-meta';
        const dateStr = s.lastSaved
            ? new Date(s.lastSaved).toLocaleString()
            : 'Unknown date';
        metaEl.textContent = `${s.totalLines} lines | ${s.annotatedLines}/${s.totalLines} annotated (${s.pct}%) | ${dateStr}`;

        info.appendChild(nameEl);
        info.appendChild(metaEl);
        card.appendChild(info);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'session-delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete session';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(s.key, s.filename);
        });
        card.appendChild(deleteBtn);

        list.appendChild(card);
    });

    container.appendChild(list);
}

function restoreSession(key) {
    const saved = localStorage.getItem(key);
    if (!saved) {
        alert('Session not found. It may have been deleted.');
        renderSessionPicker();
        return;
    }

    appState = JSON.parse(saved);
    migrateAppState();

    // Clear undo/redo stacks
    undoStack = [];
    redoStack = [];

    // Reset filter state
    currentFilter = 'all';
    currentSceneFilter = 'all';

    updateFilenameDisplay();
    showCharacterManagement();
}

function deleteSession(key, filename) {
    if (confirm(`Delete saved session for "${filename}"?`)) {
        localStorage.removeItem(key);
        renderSessionPicker();
    }
}

// --- Export/Import Project ---

function exportProject() {
    const projectData = {
        _format: 'subtitle-annotator-project',
        _version: '1.0',
        exportedAt: new Date().toISOString(),
        appState: JSON.parse(JSON.stringify(appState))
    };

    const blob = new Blob(
        [JSON.stringify(projectData, null, 2)],
        { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = appState.filename.replace(/\.(srt|ass)$/i, '') + '.saproj';
    a.click();
    URL.revokeObjectURL(url);
}

function importProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const projectData = JSON.parse(e.target.result);

            // Validate format
            if (!projectData._format || projectData._format !== 'subtitle-annotator-project') {
                alert('This does not appear to be a valid Subtitle Annotator project file (.saproj).');
                return;
            }

            if (!projectData.appState || !projectData.appState.subtitles) {
                alert('Project file is missing required data.');
                return;
            }

            appState = projectData.appState;
            migrateAppState();

            // Clear undo/redo
            undoStack = [];
            redoStack = [];

            // Reset filter state
            currentFilter = 'all';
            currentSceneFilter = 'all';

            // Save to localStorage so it appears in session picker
            saveToLocalStorage();

            updateFilenameDisplay();
            showCharacterManagement();
        } catch (err) {
            alert('Failed to load project file: ' + err.message);
        }
    };
    reader.readAsText(file);

    // Reset file input so same file can be re-imported
    event.target.value = '';
}

// --- Clear Session (used from annotation workspace) ---

function clearSession() {
    if (confirm('Are you sure you want to clear all annotations? This cannot be undone.')) {
        const key = `subtitle-annotation-${appState.filename}`;
        localStorage.removeItem(key);
        appState.subtitles.forEach(sub => {
            if (!sub.isPrefilled) {
                sub.character = null;
            }
        });
        renderSubtitleList();
        updateProgress();
    }
}
