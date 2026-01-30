// Export functions

function showExportModal() {
    document.getElementById('exportModal').classList.add('show');

    // Show/hide TXT options based on format selection
    const updateTxtOptions = () => {
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        const txtOptions = document.getElementById('txtOptions');
        txtOptions.style.display = format === 'txt' ? 'block' : 'none';
    };

    // Add event listeners to format radio buttons
    document.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
        radio.removeEventListener('change', updateTxtOptions); // Remove old listeners
        radio.addEventListener('change', updateTxtOptions);
    });

    // Initial update
    updateTxtOptions();
}

function closeExportModal() {
    document.getElementById('exportModal').classList.remove('show');
}

function handleExport() {
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    if (format === 'json') {
        exportJSON();
    } else if (format === 'csv') {
        exportCSV();
    } else if (format === 'txt') {
        exportTXT();
    }
}

function exportJSON() {
    const exportType = document.querySelector('input[name="exportType"]:checked').value;

    let dataToExport = appState.subtitles;
    if (exportType === 'annotated') {
        dataToExport = appState.subtitles.filter(s => s.character);
    }

    // Check if scenes are defined
    const hasScenes = appState.sceneBreaks && appState.sceneBreaks.length > 0;

    let jsonData;

    if (hasScenes) {
        // Hierarchical structure: scenes as top-level objects with nested lines
        const scenesMap = new Map(); // Map<sceneId, lines[]>

        dataToExport.forEach(sub => {
            // Use canonical name for export
            let characterName = sub.character || null;
            if (characterName) {
                const charObj = appState.characters.find(c => c.name === characterName);
                if (charObj && charObj.canonicalName) {
                    characterName = charObj.canonicalName;
                }
            }

            // Calculate scene ID
            const lineIndex = appState.subtitles.indexOf(sub);
            const sceneId = getSceneId(lineIndex);

            const entry = {
                timestamp: sub.timestamp,
                character: characterName,
                dialogue: sub.text
            };

            // Add line to appropriate scene
            if (!scenesMap.has(sceneId)) {
                scenesMap.set(sceneId, []);
            }
            scenesMap.get(sceneId).push(entry);
        });

        // Convert map to array of scene objects
        jsonData = Array.from(scenesMap.entries()).map(([sceneId, lines]) => ({
            sceneId: sceneId,
            lines: lines
        }));

    } else {
        // Flat structure: backwards compatibility when no scenes
        jsonData = dataToExport.map(sub => {
            // Use canonical name for export
            let characterName = sub.character || null;
            if (characterName) {
                const charObj = appState.characters.find(c => c.name === characterName);
                if (charObj && charObj.canonicalName) {
                    characterName = charObj.canonicalName;
                }
            }

            return {
                timestamp: sub.timestamp,
                character: characterName,
                dialogue: sub.text
            };
        });
    }

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = appState.filename.replace(/\.(srt|ass)$/i, '-annotated.json');
    a.click();
    URL.revokeObjectURL(url);

    closeExportModal();
}

function exportCSV() {
    const exportType = document.querySelector('input[name="exportType"]:checked').value;

    let dataToExport = appState.subtitles;
    if (exportType === 'annotated') {
        dataToExport = appState.subtitles.filter(s => s.character);
    }

    // Check if scenes are defined
    const hasScenes = appState.sceneBreaks && appState.sceneBreaks.length > 0;

    // Build CSV with header row
    const csvRows = [];
    if (hasScenes) {
        csvRows.push('scene,timestamp,character,dialogue');
    } else {
        csvRows.push('timestamp,character,dialogue');
    }

    // Add data rows
    dataToExport.forEach(sub => {
        // Use canonical name for export
        let characterName = sub.character || '';
        if (characterName) {
            const charObj = appState.characters.find(c => c.name === characterName);
            if (charObj && charObj.canonicalName) {
                characterName = charObj.canonicalName;
            }
        }

        const timestamp = escapeCSV(sub.timestamp);
        const character = escapeCSV(characterName);
        const dialogue = escapeCSV(sub.text);

        if (hasScenes) {
            const lineIndex = appState.subtitles.indexOf(sub);
            const sceneId = getSceneId(lineIndex);
            csvRows.push(`${sceneId},${timestamp},${character},${dialogue}`);
        } else {
            csvRows.push(`${timestamp},${character},${dialogue}`);
        }
    });

    // Add UTF-8 BOM to ensure Excel properly detects encoding (especially on non-English locales)
    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = appState.filename.replace(/\.(srt|ass)$/i, '-annotated.csv');
    a.click();
    URL.revokeObjectURL(url);

    closeExportModal();
}

function exportTXT() {
    const exportType = document.querySelector('input[name="exportType"]:checked').value;
    const suppressRepeated = document.getElementById('suppressRepeatedNames').checked;

    let dataToExport = appState.subtitles;
    if (exportType === 'annotated') {
        dataToExport = appState.subtitles.filter(s => s.character);
    }

    // Build dialogue text in screenplay format
    const lines = [];
    let previousCharacter = null;
    let previousSceneId = null;
    const hasScenes = appState.sceneBreaks && appState.sceneBreaks.length > 0;

    dataToExport.forEach(sub => {
        // Use canonical name for export
        let characterName = sub.character || '[Unknown]';
        if (sub.character) {
            const charObj = appState.characters.find(c => c.name === sub.character);
            if (charObj && charObj.canonicalName) {
                characterName = charObj.canonicalName;
            }
        }

        // Calculate scene ID if scenes are defined
        let currentSceneId = null;
        if (hasScenes) {
            const lineIndex = appState.subtitles.indexOf(sub);
            currentSceneId = getSceneId(lineIndex);
        }

        const characterChanged = previousCharacter !== characterName;
        const sceneChanged = hasScenes && previousSceneId !== null && currentSceneId !== previousSceneId;

        // Insert scene marker for Scene 1 at the very beginning
        if (hasScenes && previousCharacter === null) {
            lines.push('--- Scene 1 ---');
            lines.push(''); // Empty line after scene marker
        }

        // Insert scene marker if scene changed
        if (sceneChanged) {
            if (lines.length > 0) {
                lines.push(''); // Empty line before scene marker
            }
            lines.push(`--- Scene ${currentSceneId} ---`);
            lines.push(''); // Empty line after scene marker
        }

        // Determine whether to include character name
        let dialogueLine;
        if (suppressRepeated && !characterChanged && !sceneChanged && previousCharacter !== null) {
            // Suppress character name for consecutive lines from same character in same scene
            dialogueLine = sub.text;
        } else {
            // Include character name (first line, character changed, or scene changed)
            dialogueLine = `${characterName}: ${sub.text}`;
        }

        // Add appropriate spacing
        if (previousCharacter === null) {
            // First line - no spacing before
            lines.push(dialogueLine);
        } else if (sceneChanged) {
            // Scene changed - marker already added with spacing
            lines.push(dialogueLine);
        } else if (characterChanged) {
            // Different character - add empty line (double newline)
            lines.push(''); // Empty line for spacing
            lines.push(dialogueLine);
        } else {
            // Same character - single newline
            lines.push(dialogueLine);
        }

        previousCharacter = characterName;
        previousSceneId = currentSceneId;
    });

    // Join all lines with single newlines (the empty strings create double newlines)
    const txtContent = lines.join('\n');

    // Create and download the file
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = appState.filename.replace(/\.(srt|ass)$/i, '-dialogue.txt');
    a.click();
    URL.revokeObjectURL(url);

    closeExportModal();
}

function escapeCSV(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const stringValue = String(value);

    // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }

    return stringValue;
}
