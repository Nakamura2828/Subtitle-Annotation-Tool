// Export functions

function showExportModal() {
    document.getElementById('exportModal').classList.add('show');

    // Show/hide track options based on whether secondary track is loaded
    const trackOptions = document.getElementById('trackOptions');
    trackOptions.style.display = appState.hasSecondaryTrack ? 'block' : 'none';
    // Reset to default "both" when opening
    const bothRadio = document.querySelector('input[name="exportTrack"][value="both"]');
    if (bothRadio) bothRadio.checked = true;

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

// Returns the selected track export mode: 'both', 'primary', or 'secondary'
function getExportTrack() {
    if (!appState.hasSecondaryTrack) return 'primary';
    const checked = document.querySelector('input[name="exportTrack"]:checked');
    return checked ? checked.value : 'both';
}

// Returns the dialogue text for a subtitle based on track selection
function getDialogueText(sub, trackChoice) {
    if (trackChoice === 'secondary') {
        return stripASSCodes(sub.secondaryText) || '';
    }
    return stripASSCodes(sub.text);
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
    const trackChoice = getExportTrack();

    let dataToExport = appState.subtitles;
    if (exportType === 'annotated') {
        dataToExport = appState.subtitles.filter(s => s.character);
    }

    // Apply scene filter if active
    if (currentSceneFilter !== 'all') {
        const scenesWithCharacter = getScenesWithCharacter(currentSceneFilter);
        if (scenesWithCharacter && scenesWithCharacter.length > 0) {
            dataToExport = dataToExport.filter(sub => {
                const lineIndex = appState.subtitles.indexOf(sub);
                const sceneId = getSceneId(lineIndex);
                return sceneId && scenesWithCharacter.includes(sceneId);
            });
        } else {
            dataToExport = [];
        }
    }

    // Check if scenes are defined
    const hasScenes = appState.sceneBreaks && appState.sceneBreaks.length > 0;
    // Only include secondary column when track choice is "both"
    const includeSecondary = trackChoice === 'both' && appState.hasSecondaryTrack;

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
                dialogue: getDialogueText(sub, trackChoice)
            };

            // Add secondary text only when exporting both tracks
            if (includeSecondary && sub.secondaryText) {
                entry.secondaryDialogue = stripASSCodes(sub.secondaryText);
            }

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

            const entry = {
                timestamp: sub.timestamp,
                character: characterName,
                dialogue: getDialogueText(sub, trackChoice)
            };

            // Add secondary text only when exporting both tracks
            if (includeSecondary && sub.secondaryText) {
                entry.secondaryDialogue = stripASSCodes(sub.secondaryText);
            }

            return entry;
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
    const trackChoice = getExportTrack();

    let dataToExport = appState.subtitles;
    if (exportType === 'annotated') {
        dataToExport = appState.subtitles.filter(s => s.character);
    }

    // Apply scene filter if active
    if (currentSceneFilter !== 'all') {
        const scenesWithCharacter = getScenesWithCharacter(currentSceneFilter);
        if (scenesWithCharacter && scenesWithCharacter.length > 0) {
            dataToExport = dataToExport.filter(sub => {
                const lineIndex = appState.subtitles.indexOf(sub);
                const sceneId = getSceneId(lineIndex);
                return sceneId && scenesWithCharacter.includes(sceneId);
            });
        } else {
            dataToExport = [];
        }
    }

    // Check if scenes are defined
    const hasScenes = appState.sceneBreaks && appState.sceneBreaks.length > 0;
    const includeSecondary = trackChoice === 'both' && appState.hasSecondaryTrack;

    // Build CSV with header row
    const csvRows = [];
    let header;
    if (hasScenes) {
        header = 'scene,timestamp,character,dialogue';
    } else {
        header = 'timestamp,character,dialogue';
    }
    // Add secondary dialogue column only when exporting both tracks
    if (includeSecondary) {
        header += ',secondaryDialogue';
    }
    csvRows.push(header);

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
        const dialogue = escapeCSV(getDialogueText(sub, trackChoice));

        let row;
        if (hasScenes) {
            const lineIndex = appState.subtitles.indexOf(sub);
            const sceneId = getSceneId(lineIndex);
            row = `${sceneId},${timestamp},${character},${dialogue}`;
        } else {
            row = `${timestamp},${character},${dialogue}`;
        }

        // Append secondary dialogue only when exporting both tracks
        if (includeSecondary) {
            const secondaryDialogue = escapeCSV(stripASSCodes(sub.secondaryText) || '');
            row += `,${secondaryDialogue}`;
        }

        csvRows.push(row);
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
    const trackChoice = getExportTrack();

    let dataToExport = appState.subtitles;
    if (exportType === 'annotated') {
        dataToExport = appState.subtitles.filter(s => s.character);
    }

    // Apply scene filter if active
    if (currentSceneFilter !== 'all') {
        const scenesWithCharacter = getScenesWithCharacter(currentSceneFilter);
        if (scenesWithCharacter && scenesWithCharacter.length > 0) {
            dataToExport = dataToExport.filter(sub => {
                const lineIndex = appState.subtitles.indexOf(sub);
                const sceneId = getSceneId(lineIndex);
                return sceneId && scenesWithCharacter.includes(sceneId);
            });
        } else {
            dataToExport = [];
        }
    }

    // Build dialogue text in screenplay format
    const lines = [];
    let previousCharacter = null;
    let previousSceneId = null;
    const hasScenes = appState.sceneBreaks && appState.sceneBreaks.length > 0;
    const includeSecondary = trackChoice === 'both' && appState.hasSecondaryTrack;

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
        const cleanText = getDialogueText(sub, trackChoice);
        let dialogueLine;
        if (suppressRepeated && !characterChanged && !sceneChanged && previousCharacter !== null) {
            // Suppress character name for consecutive lines from same character in same scene
            dialogueLine = cleanText;
        } else {
            // Include character name (first line, character changed, or scene changed)
            dialogueLine = `${characterName}: ${cleanText}`;
        }

        // Add secondary dialogue only when exporting both tracks
        if (includeSecondary && sub.secondaryText) {
            dialogueLine += `\n[Secondary] ${stripASSCodes(sub.secondaryText)}`;
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
