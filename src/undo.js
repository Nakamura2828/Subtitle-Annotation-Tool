// Undo/Redo functionality

function deepCopyState() {
    // Deep copy the appState for undo/redo
    return {
        filename: appState.filename,
        secondaryFilename: appState.secondaryFilename || null,
        subtitles: appState.subtitles.map(sub => ({...sub})),
        characters: appState.characters.map(char => ({
            ...char,
            aliases: char.aliases ? [...char.aliases] : []
        })),
        topCharacters: [...appState.topCharacters],
        sceneBreaks: appState.sceneBreaks ? [...appState.sceneBreaks] : [],
        hasSecondaryTrack: appState.hasSecondaryTrack || false,
        lastSaved: appState.lastSaved || null,
        secondarySubtitles: appState.secondarySubtitles
            ? appState.secondarySubtitles.map(sub => ({...sub}))
            : []
    };
}

function saveStateForUndo() {
    // Save current state to undo stack
    undoStack.push(deepCopyState());

    // Limit stack size
    if (undoStack.length > MAX_UNDO_STATES) {
        undoStack.shift();
    }

    // Clear redo stack when new action is performed
    redoStack = [];
}

function performUndo() {
    if (undoStack.length === 0) {
        return false; // Nothing to undo
    }

    // Save current state to redo stack
    redoStack.push(deepCopyState());

    // Restore previous state
    const previousState = undoStack.pop();
    appState = previousState;

    // Refresh UI
    refreshCurrentView();
    saveToLocalStorage();

    return true;
}

function performRedo() {
    if (redoStack.length === 0) {
        return false; // Nothing to redo
    }

    // Save current state to undo stack
    undoStack.push(deepCopyState());

    // Restore redo state
    const redoState = redoStack.pop();
    appState = redoState;

    // Refresh UI
    refreshCurrentView();
    saveToLocalStorage();

    return true;
}

function refreshCurrentView() {
    // Determine which view is currently visible and refresh it
    const characterMgmt = document.getElementById('characterManagement');
    const annotationWs = document.getElementById('annotationWorkspace');

    if (characterMgmt.style.display !== 'none') {
        // Refresh character management view
        updateTopCharacters();
        renderCharacterList();
    } else if (annotationWs.style.display !== 'none') {
        // Refresh annotation workspace view
        updateTopCharacters();
        populateCharacterFilter();
        renderSubtitleList();
        updateProgress();
    }
}
