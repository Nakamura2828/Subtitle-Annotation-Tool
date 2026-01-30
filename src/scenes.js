// Scene management functions

function insertSceneBreak() {
    // Find the currently active line
    const activeEntry = document.querySelector('.subtitle-entry.active');
    if (!activeEntry) {
        alert('Please select a line first by clicking on it or using J/K navigation.');
        return;
    }

    const index = parseInt(activeEntry.dataset.index);

    // Check if scene break already exists at this position
    if (appState.sceneBreaks.includes(index)) {
        alert('A scene break already exists after this line.');
        return;
    }

    // Check if this is the last line
    if (index >= appState.subtitles.length - 1) {
        alert('Cannot insert scene break after the last line.');
        return;
    }

    // Save state for undo
    saveStateForUndo();

    // Add scene break and keep array sorted
    appState.sceneBreaks.push(index);
    appState.sceneBreaks.sort((a, b) => a - b);

    // Save to localStorage
    saveToLocalStorage();

    // Re-render to show the scene break
    renderSubtitleList();

    console.log(`Scene break inserted after line #${index + 1}`);
}

// Helper function to calculate scene ID for a given line index
function getSceneId(lineIndex) {
    if (!appState.sceneBreaks || appState.sceneBreaks.length === 0) {
        return null; // No scenes defined
    }

    let sceneId = 1;
    for (let i = 0; i < appState.sceneBreaks.length; i++) {
        if (lineIndex <= appState.sceneBreaks[i]) {
            return sceneId;
        }
        sceneId++;
    }
    return sceneId; // Line is after the last scene break
}

// Helper function to get all scene IDs where a character appears
function getScenesWithCharacter(characterName) {
    if (!appState.sceneBreaks || appState.sceneBreaks.length === 0) {
        return null; // No scenes defined - treat as single scene
    }

    const sceneIds = new Set();

    appState.subtitles.forEach((sub, index) => {
        // Check if this line belongs to the specified character
        if (sub.character === characterName) {
            const sceneId = getSceneId(index);
            if (sceneId !== null) {
                sceneIds.add(sceneId);
            }
        }
    });

    return Array.from(sceneIds).sort((a, b) => a - b);
}
