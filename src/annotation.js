// Annotation workspace functions

function renderAnnotationWorkspace() {
    populateCharacterFilter();
    renderKeyboardHints();
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

function handleFilterChange() {
    const filterSelect = document.getElementById('characterFilter');
    currentFilter = filterSelect.value;
    renderSubtitleList();
    updateFilterStats();
}

function updateFilterStats() {
    const statsEl = document.getElementById('filterStats');
    let filteredCount;

    if (currentFilter === 'all') {
        filteredCount = appState.subtitles.length;
        statsEl.textContent = `Showing all ${filteredCount} lines`;
    } else if (currentFilter === 'unannotated') {
        filteredCount = appState.subtitles.filter(s => !s.character).length;
        statsEl.textContent = `Showing ${filteredCount} unannotated lines`;
    } else {
        filteredCount = appState.subtitles.filter(s => s.character === currentFilter).length;
        statsEl.textContent = `Showing ${filteredCount} lines`;
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

    // Apply filter
    let filteredSubtitles = appState.subtitles;
    if (currentFilter === 'unannotated') {
        filteredSubtitles = appState.subtitles.filter(s => !s.character);
    } else if (currentFilter !== 'all') {
        filteredSubtitles = appState.subtitles.filter(s => s.character === currentFilter);
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

        entry.innerHTML = `
            <div class="entry-index">#${sub.index + 1}</div>
            <div class="entry-timestamp">${sub.timestamp}</div>
            <div class="entry-text">${sub.text}</div>
            <div class="entry-character"></div>
            <div class="entry-status">${sub.character ? '✓' : ''}</div>
        `;

        entry.querySelector('.entry-character').appendChild(select);

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
            sceneBreakDiv.innerHTML = '<hr><span>Scene Break</span>';
            container.appendChild(sceneBreakDiv);
        }
    });

    // Add keyboard listener (remove first to prevent duplicates)
    document.removeEventListener('keydown', handleKeyPress);
    document.addEventListener('keydown', handleKeyPress);
}

function handleKeyPress(e) {
    // Only handle if not in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

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
}

function navigateLines(direction) {
    const currentActive = document.querySelector('.subtitle-entry.active');
    let currentIndex = currentActive ? parseInt(currentActive.dataset.index) : -1;

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < appState.subtitles.length) {
        document.querySelectorAll('.subtitle-entry').forEach(entry => {
            entry.classList.remove('active');
        });

        const nextElement = document.querySelector(`[data-index="${nextIndex}"]`);
        if (nextElement) {
            nextElement.classList.add('active');
            nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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

    // Update active highlighting
    document.querySelectorAll('.subtitle-entry').forEach(entry => {
        entry.classList.remove('active');
    });

    if (firstUnannotated !== -1) {
        const element = document.querySelector(`[data-index="${firstUnannotated}"]`);
        if (element) {
            element.classList.add('active');
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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

    // Update the visual representation
    const entry = document.querySelector(`[data-index="${index}"]`);
    if (entry) {
        entry.classList.remove('annotated', 'prefilled', 'active');
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
