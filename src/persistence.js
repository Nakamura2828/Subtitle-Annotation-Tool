// localStorage persistence functions

function saveToLocalStorage() {
    const key = `subtitle-annotation-${appState.filename}`;
    localStorage.setItem(key, JSON.stringify(appState));
}

function checkForSavedSession() {
    // Check if there are any saved sessions in localStorage
    const savedKeys = Object.keys(localStorage).filter(key => key.startsWith('subtitle-annotation-'));

    if (savedKeys.length > 0) {
        const message = `Found ${savedKeys.length} saved session(s). Would you like to see them?`;
        if (confirm(message)) {
            const sessionList = savedKeys.map(key => {
                const filename = key.replace('subtitle-annotation-', '');
                return filename;
            }).join('\n- ');

            alert(`Saved sessions:\n- ${sessionList}\n\nLoad a file with the same name to restore your progress.`);
        }
    }
}

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
