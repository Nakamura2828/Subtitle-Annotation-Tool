// Annotation workspace functions

function renderAnnotationWorkspace() {
    populateCharacterFilter();
    populateSceneFilter();
    renderKeyboardHints();
    updateTransferBarVisibility();
    renderSubtitleList();
    updateProgress();
    // Highlight the first unannotated line for keyboard shortcuts
    scrollToNextUnannotated();
}

function populateCharacterFilter() {
    const filterSelect = document.getElementById('characterFilter');

    // Use currentFilter variable as source of truth
    const currentValue = currentFilter;

    // Clear existing character options (keep "All" and "Unannotated")
    while (filterSelect.options.length > 2) {
        filterSelect.remove(2);
    }

    // Add separator
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '─────────';
    filterSelect.appendChild(separator);

    // Add character options (only non-alias characters)
    const characters = appState.characters.filter(c => !c.isAlias && c.name !== '(Other)');
    characters.forEach(char => {
        const option = document.createElement('option');
        option.value = char.name;
        const count = appState.subtitles.filter(s => s.character === char.name).length;
        option.textContent = `${char.name} (${count} lines)`;
        filterSelect.appendChild(option);
    });

    // Add "(Other)" at the end
    const otherChar = appState.characters.find(c => c.name === '(Other)');
    if (otherChar) {
        const option = document.createElement('option');
        option.value = '(Other)';
        const count = appState.subtitles.filter(s => s.character === '(Other)').length;
        option.textContent = `(Other) (${count} lines)`;
        filterSelect.appendChild(option);
    }

    // Restore selection if it still exists
    if (currentValue && Array.from(filterSelect.options).some(opt => opt.value === currentValue)) {
        filterSelect.value = currentValue;
    } else {
        filterSelect.value = 'all';
        currentFilter = 'all';
    }
}

function populateSceneFilter() {
    const filterSelect = document.getElementById('sceneFilter');

    // Use currentSceneFilter variable as source of truth
    const currentValue = currentSceneFilter;

    // Clear existing options (keep "All scenes")
    while (filterSelect.options.length > 1) {
        filterSelect.remove(1);
    }

    // Only populate if scenes are defined
    if (!appState.sceneBreaks || appState.sceneBreaks.length === 0) {
        // No scenes defined - disable the filter
        filterSelect.disabled = true;
        filterSelect.title = "Define scene breaks first (Alt+N)";
        return;
    }

    filterSelect.disabled = false;
    filterSelect.title = "";

    // Add separator
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '─────────';
    filterSelect.appendChild(separator);

    // Add character options (only non-alias characters who have lines)
    const characters = appState.characters.filter(c => !c.isAlias && c.name !== '(Other)' && c.count > 0);
    characters.forEach(char => {
        const scenes = getScenesWithCharacter(char.name);
        if (scenes && scenes.length > 0) {
            const option = document.createElement('option');
            option.value = char.name;
            option.textContent = `${char.name} (${scenes.length} scene${scenes.length > 1 ? 's' : ''})`;
            filterSelect.appendChild(option);
        }
    });

    // Add "(Other)" at the end if it has lines
    const otherChar = appState.characters.find(c => c.name === '(Other)');
    if (otherChar && otherChar.count > 0) {
        const scenes = getScenesWithCharacter('(Other)');
        if (scenes && scenes.length > 0) {
            const option = document.createElement('option');
            option.value = '(Other)';
            option.textContent = `(Other) (${scenes.length} scene${scenes.length > 1 ? 's' : ''})`;
            filterSelect.appendChild(option);
        }
    }

    // Restore selection if it still exists
    if (currentValue && Array.from(filterSelect.options).some(opt => opt.value === currentValue)) {
        filterSelect.value = currentValue;
    } else {
        filterSelect.value = 'all';
        currentSceneFilter = 'all';
    }
}

function handleFilterChange() {
    const filterSelect = document.getElementById('characterFilter');
    currentFilter = filterSelect.value;
    renderSubtitleList();
    updateFilterStats();
}

function handleSceneFilterChange() {
    const filterSelect = document.getElementById('sceneFilter');
    currentSceneFilter = filterSelect.value;
    renderSubtitleList();
    updateFilterStats();
}

function updateFilterStats() {
    const sceneStatsEl = document.getElementById('sceneFilterStats');
    const lineStatsEl = document.getElementById('filterStats');

    // Calculate scene filter stats
    if (currentSceneFilter === 'all') {
        if (appState.sceneBreaks && appState.sceneBreaks.length > 0) {
            const totalScenes = appState.sceneBreaks.length + 1;
            sceneStatsEl.textContent = `All ${totalScenes} scenes`;
        } else {
            sceneStatsEl.textContent = 'No scenes defined';
        }
    } else {
        const scenesWithCharacter = getScenesWithCharacter(currentSceneFilter);
        if (scenesWithCharacter && scenesWithCharacter.length > 0) {
            sceneStatsEl.textContent = `${scenesWithCharacter.length} scene${scenesWithCharacter.length > 1 ? 's' : ''} with ${currentSceneFilter}`;
        } else {
            sceneStatsEl.textContent = 'No scenes found';
        }
    }

    // Calculate line filter stats (with scene filter applied)
    let filteredSubtitles = appState.subtitles;

    // Apply scene filter first
    if (currentSceneFilter !== 'all') {
        const scenesWithCharacter = getScenesWithCharacter(currentSceneFilter);
        if (scenesWithCharacter && scenesWithCharacter.length > 0) {
            filteredSubtitles = filteredSubtitles.filter((sub, index) => {
                const sceneId = getSceneId(index);
                return sceneId && scenesWithCharacter.includes(sceneId);
            });
        } else {
            filteredSubtitles = [];
        }
    }

    // Apply line filter
    let lineFilteredCount;
    if (currentFilter === 'all') {
        lineFilteredCount = filteredSubtitles.length;
        lineStatsEl.textContent = `${lineFilteredCount} total lines`;
    } else if (currentFilter === 'unannotated') {
        lineFilteredCount = filteredSubtitles.filter(s => !s.character).length;
        lineStatsEl.textContent = `${lineFilteredCount} unannotated`;
    } else {
        lineFilteredCount = filteredSubtitles.filter(s => s.character === currentFilter).length;
        lineStatsEl.textContent = `${lineFilteredCount} lines`;
    }
}

function renderKeyboardHints() {
    const container = document.getElementById('shortcutHints');
    const hints = appState.topCharacters.map((char, idx) =>
        `<div class="shortcut"><span class="key">${idx + 1}</span> ${char}</div>`
    );
    hints.push('<div class="shortcut"><span class="key">0</span> (Other)</div>');
    hints.push('<div class="shortcut"><span class="key">S</span> Jump to first unannotated</div>');
    hints.push('<div class="shortcut"><span class="key">J/K</span> Navigate up/down</div>');
    hints.push('<div class="shortcut"><span class="key">ESC</span> Clear selection</div>');
    hints.push('<div class="shortcut"><span class="key">Alt+N</span> Insert scene break</div>');
    hints.push('<div class="shortcut"><span class="key">Del</span> Delete active line</div>');
    hints.push('<div class="shortcut"><span class="key">Ctrl+Z</span> Undo</div>');
    hints.push('<div class="shortcut"><span class="key">Ctrl+Y</span> Redo</div>');
    container.innerHTML = hints.join('');
}

function renderSubtitleList() {
    const container = document.getElementById('subtitleList');
    container.innerHTML = '';

    // Add click handler to container for clearing active selection
    container.onclick = (e) => {
        // Clear if clicking on container or scene-break divider (not on subtitle entries)
        if (e.target === container || e.target.closest('.scene-break')) {
            clearActiveSelection();
        }
    };

    // Apply filters (scene filter first, then line filter)
    let filteredSubtitles = appState.subtitles;

    // Step 1: Apply scene filter if active
    if (currentSceneFilter !== 'all') {
        const scenesWithCharacter = getScenesWithCharacter(currentSceneFilter);
        if (scenesWithCharacter && scenesWithCharacter.length > 0) {
            filteredSubtitles = filteredSubtitles.filter((sub, index) => {
                const sceneId = getSceneId(index);
                return sceneId && scenesWithCharacter.includes(sceneId);
            });
        } else {
            // Character has no scenes - show nothing
            filteredSubtitles = [];
        }
    }

    // Step 2: Apply line filter
    if (currentFilter === 'unannotated') {
        filteredSubtitles = filteredSubtitles.filter(s => !s.character);
    } else if (currentFilter !== 'all') {
        filteredSubtitles = filteredSubtitles.filter(s => s.character === currentFilter);
    }

    // Update filter stats
    updateFilterStats();

    // Only show non-alias characters in dropdown
    const enabledCharacters = appState.characters.filter(c => !c.isAlias);

    filteredSubtitles.forEach((sub) => {
        const idx = appState.subtitles.indexOf(sub); // Get original index
        const entry = document.createElement('div');
        entry.className = 'subtitle-entry';
        if (sub.character) {
            entry.classList.add(sub.isPrefilled ? 'prefilled' : 'annotated');
        }
        entry.dataset.index = idx;

        const select = document.createElement('select');
        select.innerHTML = '<option value="">-- Select --</option>';
        enabledCharacters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.name;
            option.textContent = char.name;
            if (sub.character === char.name) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        select.addEventListener('change', (e) => assignCharacter(idx, e.target.value));

        // Build HTML based on whether secondary track is loaded
        let textHTML;
        const displayText = stripASSCodes(sub.text);
        if (appState.hasSecondaryTrack) {
            // Two-column layout for dual-language
            const displaySecondary = stripASSCodes(sub.secondaryText) || '';
            textHTML = `
                <div class="entry-text-dual">
                    <div class="entry-text-primary">
                        <div class="text-label">Primary</div>
                        <div class="text-content editable-primary" contenteditable="true" data-index="${idx}">${displayText}</div>
                        <button class="link-secondary-btn" onclick="showLinkSecondaryModal(${idx}); event.stopPropagation();">Link...</button>
                    </div>
                    <div class="entry-text-secondary">
                        <div class="text-label">Secondary</div>
                        <div class="text-content editable" contenteditable="true" data-index="${idx}">${displaySecondary}</div>
                    </div>
                </div>
            `;
        } else {
            // Single column for primary only
            textHTML = `<div class="entry-text editable-primary" contenteditable="true" data-index="${idx}">${displayText}</div>`;
        }

        entry.innerHTML = `
            <div class="entry-index">#${sub.index + 1}</div>
            <div class="entry-timestamp">${sub.timestamp}</div>
            ${textHTML}
            <div class="entry-character"></div>
            <div class="entry-status">${sub.character ? '✓' : ''}</div>
        `;

        entry.querySelector('.entry-character').appendChild(select);

        // Add event listener for primary text editing
        const editablePrimary = entry.querySelector('.editable-primary');
        if (editablePrimary) {
            editablePrimary.addEventListener('blur', (e) => {
                updatePrimaryText(idx, e.target.textContent);
            });
            editablePrimary.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        }

        // Add event listener for secondary text editing (if dual-track mode)
        if (appState.hasSecondaryTrack) {
            const editableDiv = entry.querySelector('.text-content.editable');
            if (editableDiv) {
                editableDiv.addEventListener('blur', (e) => {
                    updateSecondaryText(idx, e.target.textContent);
                });
                // Prevent Enter key from creating new lines (optional)
                editableDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.target.blur(); // Save on Enter
                    }
                });
            }
        }

        // Make entry clickable to set as active
        entry.addEventListener('click', (e) => {
            // Don't interfere with dropdown interaction
            if (e.target.tagName === 'SELECT' || e.target.closest('.entry-character')) {
                return;
            }

            // Remove active class from all entries
            document.querySelectorAll('.subtitle-entry').forEach(el => {
                el.classList.remove('active');
            });

            // Add active class to clicked entry
            entry.classList.add('active');
        });

        container.appendChild(entry);

        // Check if there's a scene break after this line
        if (appState.sceneBreaks && appState.sceneBreaks.includes(idx)) {
            const sceneBreakDiv = document.createElement('div');
            sceneBreakDiv.className = 'scene-break';

            // Disable delete button when filters are active (unclear context)
            const filtersActive = currentFilter !== 'all' || currentSceneFilter !== 'all';
            const deleteButtonDisabled = filtersActive ? 'disabled' : '';
            const deleteButtonTitle = filtersActive
                ? 'Clear filters to delete scene breaks'
                : 'Delete scene break';

            sceneBreakDiv.innerHTML = `
                <hr>
                <span>Scene Break</span>
                <button class="scene-break-delete"
                        onclick="deleteSceneBreak(${idx})"
                        title="${deleteButtonTitle}"
                        ${deleteButtonDisabled}>✕</button>
            `;
            container.appendChild(sceneBreakDiv);
        }
    });

    // Add keyboard listener (remove first to prevent duplicates)
    document.removeEventListener('keydown', handleKeyPress);
    document.addEventListener('keydown', handleKeyPress);
}

function handleKeyPress(e) {
    // Only handle if not in an input field or contenteditable
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;

    const key = e.key.toLowerCase();

    // Check for ESC key - clear active selection
    if (key === 'escape') {
        e.preventDefault();
        clearActiveSelection();
        return;
    }

    // Check for '0' key - always assign (Other)
    if (key === '0') {
        e.preventDefault();
        assignToActiveLine('(Other)');
        return;
    }

    // Check for number keys 1-9 - assign to active line
    if (key >= '1' && key <= '9') {
        e.preventDefault();
        const charIndex = parseInt(key) - 1;
        if (charIndex < appState.topCharacters.length) {
            const character = appState.topCharacters[charIndex];
            assignToActiveLine(character);
        }
        return;
    }

    // Check for 's' key (skip) - move to next unannotated line
    if (key === 's') {
        e.preventDefault();
        scrollToNextUnannotated();
        return;
    }

    // Check for j/k or arrow keys for navigation
    if (key === 'j' || key === 'arrowdown') {
        e.preventDefault();
        navigateLines(1);
        return;
    }
    if (key === 'k' || key === 'arrowup') {
        e.preventDefault();
        navigateLines(-1);
        return;
    }

    // Check for Alt+N - insert scene break
    if (e.altKey && key === 'n') {
        e.preventDefault();
        insertSceneBreak();
        return;
    }

    // Check for Delete key - delete active line
    if (e.key === 'Delete') {
        e.preventDefault();
        deleteActiveLine();
        return;
    }
}

function navigateLines(direction) {
    const entries = Array.from(document.querySelectorAll('.subtitle-entry'));
    if (entries.length === 0) return;

    const currentActive = document.querySelector('.subtitle-entry.active');

    if (!currentActive) {
        // No active entry - activate first or last depending on direction
        const target = direction > 0 ? entries[0] : entries[entries.length - 1];
        target.classList.add('active');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const currentPos = entries.indexOf(currentActive);
    const nextPos = currentPos + direction;

    if (nextPos >= 0 && nextPos < entries.length) {
        currentActive.classList.remove('active');
        entries[nextPos].classList.add('active');
        entries[nextPos].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function assignToActiveLine(character) {
    // Find the currently active line (highlighted with orange border)
    const activeEntry = document.querySelector('.subtitle-entry.active');
    if (activeEntry) {
        const index = parseInt(activeEntry.dataset.index);
        assignCharacter(index, character);
        // Move to next unannotated line after assignment
        scrollToNextUnannotated();
    } else {
        // No active line - fall back to first unannotated
        assignToFirstUnannotated(character);
    }
}

function assignToFirstUnannotated(character) {
    const firstUnannotated = appState.subtitles.findIndex(s => !s.character);
    if (firstUnannotated !== -1) {
        assignCharacter(firstUnannotated, character);
        scrollToNextUnannotated();
    }
}

function scrollToNextUnannotated() {
    // Find the first unannotated line
    const firstUnannotated = appState.subtitles.findIndex(s => !s.character);

    // If all lines are annotated, leave current active state as-is
    if (firstUnannotated === -1) return;

    // Update active highlighting
    document.querySelectorAll('.subtitle-entry').forEach(entry => {
        entry.classList.remove('active');
    });

    const element = document.querySelector(`.subtitle-entry[data-index="${firstUnannotated}"]`);
    if (element) {
        element.classList.add('active');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function clearActiveSelection() {
    // Remove active class from all subtitle entries
    document.querySelectorAll('.subtitle-entry').forEach(entry => {
        entry.classList.remove('active');
    });
}

function assignCharacter(index, character) {
    // Save state for undo
    saveStateForUndo();

    appState.subtitles[index].character = character || null;
    appState.subtitles[index].isPrefilled = false;

    saveToLocalStorage();
    updateProgress();
    populateCharacterFilter(); // Update filter counts
    populateSceneFilter(); // Update scene filter counts

    // Update the visual representation
    const entry = document.querySelector(`.subtitle-entry[data-index="${index}"]`);
    if (entry) {
        entry.classList.remove('annotated', 'prefilled');
        if (character) {
            entry.classList.add('annotated');
        }
        entry.querySelector('.entry-status').textContent = character ? '✓' : '';

        // Update the dropdown value
        const select = entry.querySelector('select');
        if (select) {
            select.value = character || '';
        }
    }
}

function updatePrimaryText(index, newText) {
    const trimmed = newText.trim();
    // Only save if the text actually changed
    if (trimmed === stripASSCodes(appState.subtitles[index].text)) return;

    saveStateForUndo();
    appState.subtitles[index].text = trimmed;
    saveToLocalStorage();
}

function updateSecondaryText(index, newText) {
    // Save state for undo
    saveStateForUndo();

    // Update the secondary text (allow empty string to be saved as null)
    appState.subtitles[index].secondaryText = newText.trim() || null;

    saveToLocalStorage();
}

// --- Link Secondary Modal (v1.6.1) ---

// Track which primary line is being linked
let linkingPrimaryIndex = null;

function showLinkSecondaryModal(primaryIndex) {
    linkingPrimaryIndex = primaryIndex;
    const primary = appState.subtitles[primaryIndex];

    // Show primary line info
    document.getElementById('linkSecondaryInfo').textContent =
        `Primary line #${primary.index + 1}`;
    document.getElementById('linkPrimaryText').textContent =
        stripASSCodes(primary.text);

    // Populate secondary lines list
    const listContainer = document.getElementById('secondaryLineList');
    listContainer.innerHTML = '';

    const linkedIndices = primary.secondaryIndices || [];

    appState.secondarySubtitles.forEach((sec, secIdx) => {
        const item = document.createElement('div');
        item.className = 'secondary-line-item';

        // Check if this secondary line is currently linked to the primary
        const isLinked = linkedIndices.includes(secIdx);

        if (isLinked) {
            item.classList.add('selected');
        }

        const displayText = stripASSCodes(sec.text);

        item.innerHTML = `
            <input type="checkbox" data-sec-index="${secIdx}" ${isLinked ? 'checked' : ''}>
            <span class="secondary-line-timestamp">${sec.timestamp}</span>
            <span class="secondary-line-text">${displayText}</span>
        `;

        // Toggle selection on click
        item.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT') {
                // Checkbox clicked directly - update visual state
                item.classList.toggle('selected', e.target.checked);
            } else {
                // Clicked elsewhere on the row - toggle checkbox
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                item.classList.toggle('selected', checkbox.checked);
            }
        });

        listContainer.appendChild(item);
    });

    document.getElementById('linkSecondaryModal').classList.add('show');

    // Scroll after modal is visible (scrollIntoView doesn't work on hidden elements)
    requestAnimationFrame(() => {
        scrollToMatchingRegion(listContainer, primary);
    });
}

function scrollToMatchingRegion(listContainer, primary) {
    // Try to scroll to the region of secondary lines near the primary's timestamp
    const primaryTime = parseTimestamp(primary.timestamp);
    if (!primaryTime) return;

    let bestIdx = 0;
    let bestDiff = Infinity;

    appState.secondarySubtitles.forEach((sec, idx) => {
        const secTime = parseTimestamp(sec.timestamp);
        if (secTime) {
            const diff = Math.abs(secTime.start - primaryTime.start);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = idx;
            }
        }
    });

    // Scroll to the best matching item (with some offset to show context)
    const items = listContainer.querySelectorAll('.secondary-line-item');
    const targetIdx = Math.max(0, bestIdx - 2);
    if (items[targetIdx]) {
        items[targetIdx].scrollIntoView({ block: 'start' });
    }
}

function clearLinkSelection() {
    const checkboxes = document.querySelectorAll('#secondaryLineList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
        cb.closest('.secondary-line-item').classList.remove('selected');
    });
}

function confirmLinkSecondary() {
    if (linkingPrimaryIndex === null) return;

    saveStateForUndo();

    // Gather selected secondary lines
    const checkedBoxes = document.querySelectorAll('#secondaryLineList input[type="checkbox"]:checked');
    const selectedIndices = [];
    const selectedTexts = [];

    checkedBoxes.forEach(cb => {
        const secIdx = parseInt(cb.dataset.secIndex);
        selectedIndices.push(secIdx);
        selectedTexts.push(appState.secondarySubtitles[secIdx].text);
    });

    // Update the primary line's secondary text and index tracking
    const sub = appState.subtitles[linkingPrimaryIndex];
    sub.secondaryText = selectedTexts.length > 0 ? selectedTexts.join('\n') : null;
    sub.secondaryIndices = selectedIndices;

    saveToLocalStorage();
    closeLinkSecondaryModal();
    renderSubtitleList();
}

function closeLinkSecondaryModal() {
    linkingPrimaryIndex = null;
    document.getElementById('linkSecondaryModal').classList.remove('show');
}

function shiftSecondaryBelow(direction) {
    if (linkingPrimaryIndex === null) return;

    saveStateForUndo();

    const start = linkingPrimaryIndex;
    const subs = appState.subtitles;

    if (direction === 1) {
        // Shift down: each primary line gets the mapping from the line above it.
        // Work backwards to avoid overwriting source data.
        // Find the last primary line that has a mapping (no point shifting beyond that).
        let lastMapped = subs.length - 1;
        while (lastMapped >= start && (!subs[lastMapped].secondaryIndices || subs[lastMapped].secondaryIndices.length === 0)) {
            lastMapped--;
        }
        // Shift from lastMapped+1 down to start (backwards)
        for (let i = Math.min(lastMapped + 1, subs.length - 1); i >= start; i--) {
            if (i === start) {
                // Current line becomes unmapped
                subs[i].secondaryIndices = [];
                subs[i].secondaryText = null;
            } else {
                // Take mapping from the line above
                const source = subs[i - 1];
                subs[i].secondaryIndices = source.secondaryIndices ? [...source.secondaryIndices] : [];
                subs[i].secondaryText = source.secondaryText;
            }
        }
    } else {
        // Shift up: each primary line gets the mapping from the line below it.
        // Work forwards to avoid overwriting source data.
        for (let i = start; i < subs.length; i++) {
            if (i === subs.length - 1) {
                // Last line has nothing below it - becomes unmapped
                subs[i].secondaryIndices = [];
                subs[i].secondaryText = null;
            } else {
                // Take mapping from the line below
                const source = subs[i + 1];
                subs[i].secondaryIndices = source.secondaryIndices ? [...source.secondaryIndices] : [];
                subs[i].secondaryText = source.secondaryText;
            }
        }
    }

    saveToLocalStorage();
    closeLinkSecondaryModal();
    renderSubtitleList();
}

function updateProgress() {
    const total = appState.subtitles.length;
    const annotated = appState.subtitles.filter(s => s.character).length;
    const percentage = total > 0 ? (annotated / total) * 100 : 0;

    const progressFill = document.getElementById('progressFill');
    progressFill.style.width = percentage + '%';
    progressFill.textContent = `${annotated} / ${total} annotated`;

    const exportStats = document.getElementById('exportStats');
    exportStats.textContent = `${annotated} lines annotated, ${total - annotated} remaining`;
}

// --- Delete Line ---

function deleteActiveLine() {
    const activeEntry = document.querySelector('.subtitle-entry.active');
    if (!activeEntry) return;

    const delIdx = parseInt(activeEntry.dataset.index);

    saveStateForUndo();

    // Remove the subtitle line
    appState.subtitles.splice(delIdx, 1);

    // Adjust scene breaks: remove any at the deleted index, decrement those above it
    if (appState.sceneBreaks && appState.sceneBreaks.length > 0) {
        appState.sceneBreaks = appState.sceneBreaks
            .filter(idx => idx !== delIdx)
            .map(idx => idx > delIdx ? idx - 1 : idx);
    }

    // Recount character counts
    appState.characters.forEach(char => {
        char.count = appState.subtitles.filter(s => s.character === char.name).length;
    });

    saveToLocalStorage();
    populateCharacterFilter();
    populateSceneFilter();
    renderSubtitleList();
    updateProgress();

    // Activate the line that took the deleted line's position (or the last line)
    const newActiveIdx = Math.min(delIdx, appState.subtitles.length - 1);
    if (newActiveIdx >= 0) {
        const newActive = document.querySelector(`.subtitle-entry[data-index="${newActiveIdx}"]`);
        if (newActive) {
            newActive.classList.add('active');
            newActive.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// --- Annotation Transfer (v1.7.1) ---

function updateTransferBarVisibility() {
    const bar = document.getElementById('annotationTransferBar');
    if (bar) {
        bar.style.display = appState.hasSecondaryTrack ? 'flex' : 'none';
    }
}

function showTransferModal() {
    // Count aligned vs unaligned lines for the preview
    let alignedCount = 0;
    let unalignedCount = 0;
    appState.subtitles.forEach(sub => {
        if (sub.secondaryText) {
            alignedCount++;
        } else {
            unalignedCount++;
        }
    });

    const previewEl = document.getElementById('transferPreview');
    previewEl.textContent = `${alignedCount} lines have secondary text and will be replaced. ${unalignedCount} lines have no secondary text.`;

    document.getElementById('transferModal').classList.add('show');
}

function closeTransferModal() {
    document.getElementById('transferModal').classList.remove('show');
}

function confirmTransfer() {
    const keepOriginal = document.getElementById('transferKeepOriginal').checked;

    saveStateForUndo();

    // Replace primary text with secondary text
    appState.subtitles.forEach(sub => {
        if (sub.secondaryText) {
            // Aligned line: replace primary text with secondary
            sub.text = sub.secondaryText;
        } else if (!keepOriginal) {
            // Unaligned line with "keep original" unchecked: blank the text
            sub.text = '';
        }
        // else: unaligned line with "keep original" checked: leave text as-is

        // Clear secondary fields
        sub.secondaryText = null;
        sub.secondaryIndices = [];
    });

    // Update filename: [secondaryFilename] (reannotated)
    // Old session stays in localStorage under the original key
    const newFilename = `${appState.secondaryFilename || 'secondary'} (reannotated)`;
    appState.filename = newFilename;

    // Clear secondary track
    appState.hasSecondaryTrack = false;
    appState.secondaryFilename = null;
    appState.secondarySubtitles = [];

    // Recount character counts (preserve existing character list/aliases/ordering)
    appState.characters.forEach(char => {
        char.count = appState.subtitles.filter(s => s.character === char.name).length;
    });

    // Save under new key
    saveToLocalStorage();

    // Update UI
    updateFilenameDisplay();
    updateTransferBarVisibility();
    populateCharacterFilter();
    populateSceneFilter();
    renderSubtitleList();
    updateProgress();

    closeTransferModal();
}
