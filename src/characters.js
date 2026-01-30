// Character management functions

function extractCharacters() {
    const characterCounts = {};

    // Count characters from all subtitles
    appState.subtitles.forEach(sub => {
        if (sub.character && !isNonCharacterName(sub.character)) {
            characterCounts[sub.character] = (characterCounts[sub.character] || 0) + 1;
        }
    });

    // Check for global character list in localStorage
    const globalListStr = localStorage.getItem('global-character-list');
    let characters = [];
    let useGlobalList = false;

    if (globalListStr) {
        try {
            const globalList = JSON.parse(globalListStr);
            const charCount = globalList.filter(c => c.name !== '(Other)').length;

            // Ask user if they want to use the global list
            const choice = confirm(
                `Found a saved global character list with ${charCount} characters.\n\n` +
                `Click OK to use this list (maintains order across files).\n` +
                `Click Cancel to use only characters from this file.`
            );

            if (choice) {
                useGlobalList = true;

                // Build alias-to-canonical mapping
                const aliasMap = {};
                globalList.forEach(char => {
                    if (char.aliases && char.aliases.length > 0) {
                        char.aliases.forEach(alias => {
                            aliasMap[alias] = char.canonicalName || char.name;
                        });
                    }
                });

                // Map detected character names through aliases and update subtitles
                const mappedCounts = {};
                Object.keys(characterCounts).forEach(detectedName => {
                    const canonicalName = aliasMap[detectedName] || detectedName;
                    mappedCounts[canonicalName] = (mappedCounts[canonicalName] || 0) + characterCounts[detectedName];

                    // Update subtitles to use canonical names if this is an alias
                    if (aliasMap[detectedName]) {
                        appState.subtitles.forEach(sub => {
                            if (sub.character === detectedName) {
                                sub.character = canonicalName;
                            }
                        });
                    }
                });

                // Use global list order, but update counts from mapped counts
                characters = globalList.map(char => ({
                    name: char.name,
                    canonicalName: char.canonicalName || char.name,
                    aliases: char.aliases || [],
                    count: mappedCounts[char.name] || 0,
                    isAlias: char.isAlias || false
                }));

                // Add any new characters from current file not in global list (and not aliases)
                Object.keys(characterCounts).forEach(name => {
                    if (!characters.some(c => c.name === name) && !aliasMap[name]) {
                        characters.push({
                            name,
                            canonicalName: name,
                            aliases: [],
                            count: characterCounts[name],
                            isAlias: false
                        });
                    }
                });
            }
        } catch (err) {
            console.error('Error loading global character list:', err);
        }
    }

    if (!useGlobalList) {
        // No global list or user declined - sort by frequency
        characters = Object.entries(characterCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({
                name,
                canonicalName: name,
                aliases: [],
                count,
                isAlias: false
            }));
    }

    // Always ensure "(Other)" is first
    const otherIndex = characters.findIndex(c => c.name === '(Other)');
    if (otherIndex === -1) {
        characters.unshift({
            name: '(Other)',
            canonicalName: '(Other)',
            aliases: [],
            count: 0,
            isAlias: false
        });
    } else if (otherIndex !== 0) {
        const other = characters.splice(otherIndex, 1)[0];
        characters.unshift(other);
    }

    appState.characters = characters;
    updateTopCharacters();
}

function clearGlobalCharacterList() {
    const confirm = window.confirm(
        'Are you sure you want to clear the global character list?\n\n' +
        'This will remove the saved character order that applies to new files.\n' +
        'The current file\'s character list will not be affected.'
    );

    if (confirm) {
        localStorage.removeItem('global-character-list');
        alert('Global character list cleared.');
    }
}

function updateTopCharacters() {
    // Exclude "(Other)" from 1-9 hotkeys (it's always on 0)
    // Also exclude aliases (only show canonical characters)
    appState.topCharacters = appState.characters
        .filter(c => !c.isAlias && c.name !== '(Other)')
        .slice(0, 9)
        .map(c => c.name);
}

function showCharacterManagement() {
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('annotationWorkspace').style.display = 'none';
    document.getElementById('characterManagement').style.display = 'block';

    const totalLines = appState.subtitles.length;
    const prefilledLines = appState.subtitles.filter(s => s.isPrefilled).length;

    let infoText = `Loaded ${totalLines} subtitle entries. `;
    if (appState.characters.length > 0) {
        infoText += `Found ${appState.characters.length} characters (${prefilledLines} lines pre-annotated).`;
    } else {
        infoText += 'No characters detected. You can add them manually below.';
    }

    document.getElementById('characterInfo').textContent = infoText;
    renderCharacterList();

    // Add event delegation for checkbox changes
    const characterList = document.getElementById('characterList');
    characterList.removeEventListener('change', handleCheckboxChange); // Remove old listener if exists
    characterList.addEventListener('change', handleCheckboxChange);
}

function handleCheckboxChange(e) {
    if (e.target.classList.contains('char-select')) {
        updateMergeButtonState();
    }
}

function renderCharacterList() {
    const container = document.getElementById('characterList');

    // Force a complete DOM clear and rebuild
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (appState.characters.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.cssText = 'grid-column: 1/-1; text-align: center; color: #6c757d;';
        emptyMsg.textContent = 'No characters found. Add characters using the input below.';
        container.appendChild(emptyMsg);
        return;
    }

    // Filter out alias entries for now (we'll show them differently later)
    const mainCharacters = appState.characters.filter(c => !c.isAlias);

    mainCharacters.forEach((char, idx) => {
        const actualIdx = appState.characters.indexOf(char);
        const item = document.createElement('div');
        item.className = 'character-item';

        const isOther = char.name === '(Other)';
        const isFirst = actualIdx === 0;
        const isLast = actualIdx === appState.characters.length - 1;

        // Mark "(Other)" as special with darker background
        if (isOther) {
            item.classList.add('special');
        }

        // Disable both arrows for "(Other)" since it's locked to first position
        // Also disable left arrow for first real character (can't move left past "(Other)")
        const disableLeft = actualIdx <= 1 || isOther;
        const disableRight = isLast || isOther;

        item.innerHTML = `
            <input type="checkbox" id="char-${actualIdx}" class="char-select" data-index="${actualIdx}">
            <div style="display: flex; flex-direction: column; flex: 1; gap: 4px;">
                <div style="display: flex; gap: 8px; align-items: center;">
                    <label for="char-${actualIdx}" class="character-name">${char.name}</label>
                    <span class="character-count">(${char.count})</span>
                </div>
            </div>
            <div class="button-container">
                <div class="button-row">
                    <button class="reorder-btn" onclick="moveCharacter(${actualIdx}, -1)" ${disableLeft ? 'disabled' : ''} title="Move left">◀</button>
                    <button class="reorder-btn" onclick="moveCharacter(${actualIdx}, 1)" ${disableRight ? 'disabled' : ''} title="Move right">▶</button>
                </div>
                <div class="button-row">
                    <button class="action-btn edit" onclick="editCharacterName(${actualIdx})" title="Edit name" ${isOther ? 'disabled style="opacity: 0.2; cursor: not-allowed;"' : ''}>✏️</button>
                    <button class="action-btn delete" onclick="deleteCharacter(${actualIdx})" title="Delete character" ${isOther ? 'disabled style="opacity: 0.2; cursor: not-allowed;"' : ''}>🗑️</button>
                </div>
            </div>
        `;

        // Show aliases if they exist with individual unmerge buttons
        if (char.aliases && char.aliases.length > 0) {
            // Determine if this section should be expanded
            const aliasKey = `char-${actualIdx}`;

            // Initialize expanded state if not set (default to collapsed)
            if (aliasExpandedState[aliasKey] === undefined) {
                aliasExpandedState[aliasKey] = false;
            }
            const isExpanded = aliasExpandedState[aliasKey];

            // Create wrapper for alias section
            const aliasWrapper = document.createElement('div');
            aliasWrapper.style.cssText = 'margin-top: 4px;';

            // Create toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 2px 4px; color: #6c757d; font-size: 12px; font-style: italic;';
            toggleBtn.innerHTML = `${isExpanded ? '▼' : '▶'} Aliases (${char.aliases.length})`;
            toggleBtn.onclick = () => toggleAliasExpansion(aliasKey);
            aliasWrapper.appendChild(toggleBtn);

            // Create alias content section
            const aliasSection = document.createElement('div');
            aliasSection.id = `alias-section-${aliasKey}`;
            aliasSection.style.cssText = `font-size: 12px; font-style: italic; color: #6c757d; display: ${isExpanded ? 'flex' : 'none'}; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;`;

            char.aliases.forEach((alias, aliasIdx) => {
                const aliasChip = document.createElement('span');
                aliasChip.style.cssText = 'background-color: #d5d8db; padding: 2px 6px; border-radius: 3px; display: inline-flex; align-items: center; gap: 4px;';
                aliasChip.innerHTML = `
                    ${alias}
                    <button onclick="unmergeAlias(${actualIdx}, ${aliasIdx})" style="background: none; border: none; cursor: pointer; color: #e74c3c; padding: 0; font-size: 11px;" title="Unmerge this alias">✖</button>
                `;
                aliasSection.appendChild(aliasChip);
            });

            aliasWrapper.appendChild(aliasSection);

            // Append to the left content wrapper (second child of item)
            item.children[1].appendChild(aliasWrapper);
        }

        container.appendChild(item);
    });

    // Update merge button state
    updateMergeButtonState();
}

function updateMergeButtonState() {
    const selectedCheckboxes = document.querySelectorAll('.char-select:checked');
    const mergeBtn = document.getElementById('mergeBtn');

    if (mergeBtn) {
        mergeBtn.disabled = selectedCheckboxes.length < 1;
    }
}

function showMergeModal() {
    const selectedCheckboxes = document.querySelectorAll('.char-select:checked');
    if (selectedCheckboxes.length < 1) {
        alert('Please select at least 1 character');
        return;
    }

    // Get selected character indices
    const selectedIndices = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.index));
    const selectedCharacters = selectedIndices.map(idx => appState.characters[idx]);

    // Check if "(Other)" is selected
    if (selectedCharacters.some(c => c.name === '(Other)')) {
        alert('Cannot merge the "(Other)" category');
        return;
    }

    // Update modal title based on selection count
    const modalTitle = document.querySelector('#mergeModal h3');
    const isSingleCharacter = selectedCharacters.length === 1;
    modalTitle.textContent = isSingleCharacter ? 'Set Canonical Name' : 'Merge Characters';

    // Update instructional text
    const modalInstruction = document.querySelector('#mergeModal p');
    modalInstruction.textContent = isSingleCharacter
        ? 'Enter the canonical name for this character:'
        : 'Select the canonical name for the merged character:';

    // Populate merge options
    const mergeOptions = document.getElementById('mergeOptions');
    mergeOptions.innerHTML = '';

    // For single character, only show existing name if there are aliases
    // For multiple characters, show all selected characters
    if (!isSingleCharacter) {
        selectedCharacters.forEach((char, idx) => {
            const label = document.createElement('label');
            label.style.cssText = 'display: block; margin: 10px 0;';
            label.innerHTML = `
                <input type="radio" name="mergeCanonical" value="${idx}" ${idx === 0 ? 'checked' : ''}>
                ${char.name} (${char.count} lines)
            `;
            mergeOptions.appendChild(label);
        });
    }

    // Reset custom name field and check the custom radio
    document.getElementById('customCanonicalName').value = '';
    if (isSingleCharacter) {
        // For single character, pre-populate with current name and select custom option
        document.getElementById('customCanonicalName').value = selectedCharacters[0].name;
        document.querySelector('input[value="custom"]').checked = true;
    }

    // Update preview
    updateMergePreview();

    // Show modal
    document.getElementById('mergeModal').classList.add('show');

    // Add event listeners for preview updates
    document.querySelectorAll('input[name="mergeCanonical"]').forEach(radio => {
        radio.addEventListener('change', updateMergePreview);
    });
    document.getElementById('customCanonicalName').addEventListener('input', updateMergePreview);
}

function updateMergePreview() {
    const selectedCheckboxes = document.querySelectorAll('.char-select:checked');
    const selectedIndices = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.index));
    const selectedCharacters = selectedIndices.map(idx => appState.characters[idx]);

    const totalLines = selectedCharacters.reduce((sum, char) => sum + char.count, 0);
    const charCount = selectedCharacters.length;

    const preview = document.getElementById('mergePreview');
    if (charCount === 1) {
        preview.textContent = `Setting canonical name for ${selectedCharacters[0].name} (${totalLines} lines)`;
    } else {
        preview.textContent = `Merging ${charCount} characters (${totalLines} total lines)`;
    }
}

function closeMergeModal() {
    document.getElementById('mergeModal').classList.remove('show');
}

function confirmMerge() {
    const selectedCheckboxes = document.querySelectorAll('.char-select:checked');
    const selectedIndices = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.index));
    const selectedCharacters = selectedIndices.map(idx => appState.characters[idx]);

    // Determine canonical name
    const canonicalChoice = document.querySelector('input[name="mergeCanonical"]:checked').value;
    let canonicalName;

    if (canonicalChoice === 'custom') {
        canonicalName = document.getElementById('customCanonicalName').value.trim();
        if (!canonicalName) {
            alert('Please enter a custom canonical name');
            return;
        }
    } else {
        canonicalName = selectedCharacters[parseInt(canonicalChoice)].name;
    }

    // Save state for undo
    saveStateForUndo();

    // Check for single-character rename vs multi-character merge
    if (selectedCharacters.length === 1) {
        // Single-character rename: set canonical name and preserve old name as alias
        const char = appState.characters[selectedIndices[0]];
        const oldName = char.name;

        // Update canonical name
        char.canonicalName = canonicalName;

        // If name changed, add old name to aliases and update everything
        if (oldName !== canonicalName) {
            // Add old name to aliases (if not already there)
            if (!char.aliases.includes(oldName)) {
                char.aliases.push(oldName);
            }

            // Update all annotations with this character to use canonical name
            appState.subtitles.forEach(sub => {
                if (sub.character === oldName) {
                    sub.character = canonicalName;
                }
            });

            // Update the character's display name
            char.name = canonicalName;
        }
    } else {
        // Multi-character merge: use existing merge logic
        mergeCharacters(selectedIndices, canonicalName);
    }

    // Close modal and update UI
    closeMergeModal();
    renderCharacterList();
    updateTopCharacters();
    saveToLocalStorage();

    // Update annotation workspace if visible
    if (document.getElementById('annotationWorkspace').style.display !== 'none') {
        populateCharacterFilter();
        renderSubtitleList();
        updateProgress();
    }
}

function toggleAliasExpansion(aliasKey) {
    // Toggle the expanded state
    aliasExpandedState[aliasKey] = !aliasExpandedState[aliasKey];

    // Re-render to update the UI
    renderCharacterList();
}

function unmergeAlias(canonicalIndex, aliasIndex) {
    const canonicalChar = appState.characters[canonicalIndex];
    const aliasName = canonicalChar.aliases[aliasIndex];

    const confirmUnmerge = confirm(
        `Unmerge "${aliasName}" from "${canonicalChar.name}"?\n\n` +
        `This will create a new character entry for "${aliasName}" with 0 lines.\n` +
        `You'll need to manually reassign lines if desired.`
    );

    if (!confirmUnmerge) return;

    // Save state for undo
    saveStateForUndo();

    // Remove alias from canonical character
    canonicalChar.aliases.splice(aliasIndex, 1);

    // Create new character entry for the unmerged alias
    appState.characters.push({
        name: aliasName,
        canonicalName: aliasName,
        aliases: [],
        count: 0,
        isAlias: false
    });

    // Update UI
    updateTopCharacters();
    renderCharacterList();
    saveToLocalStorage();

    // Update annotation workspace if visible
    if (document.getElementById('annotationWorkspace').style.display !== 'none') {
        populateCharacterFilter();
        renderSubtitleList();
        updateProgress();
    }
}

function mergeCharacters(indices, canonicalName) {
    // Sort indices in descending order to avoid index shifting issues
    indices.sort((a, b) => b - a);

    // Find or create the canonical character
    let canonicalChar = appState.characters.find(c => c.name === canonicalName);
    let canonicalIndex;

    if (canonicalChar) {
        canonicalIndex = appState.characters.indexOf(canonicalChar);
    } else {
        // Create new canonical character
        canonicalChar = {
            name: canonicalName,
            canonicalName: canonicalName,
            aliases: [],
            count: 0,
            isAlias: false
        };
        appState.characters.push(canonicalChar);
        canonicalIndex = appState.characters.length - 1;
    }

    // Merge all selected characters into canonical
    const aliasNames = [];
    let totalCount = canonicalChar.count;

    indices.forEach(idx => {
        const char = appState.characters[idx];
        if (char.name !== canonicalName) {
            // Add this character as an alias
            aliasNames.push(char.name);
            totalCount += char.count;

            // Also add any existing aliases
            if (char.aliases && char.aliases.length > 0) {
                aliasNames.push(...char.aliases);
            }

            // Update all annotations with this character to use canonical name
            appState.subtitles.forEach(sub => {
                if (sub.character === char.name) {
                    sub.character = canonicalName;
                }
            });
        }
    });

    // Update canonical character
    canonicalChar.aliases = [...new Set([...canonicalChar.aliases, ...aliasNames])]; // Deduplicate
    canonicalChar.count = totalCount;

    // Remove merged characters (skip the canonical if it was in the selection)
    indices.forEach(idx => {
        if (idx !== canonicalIndex) {
            appState.characters.splice(idx, 1);
        }
    });

    // Update top characters list
    updateTopCharacters();

    // Update progress display
    if (document.getElementById('annotationWorkspace').style.display !== 'none') {
        populateCharacterFilter();
        renderSubtitleList();
        updateProgress();
    }
}

function addNewCharacter() {
    const input = document.getElementById('newCharacterInput');
    const name = input.value.trim();

    if (!name) {
        alert('Please enter a character name');
        return;
    }

    if (appState.characters.some(c => c.name === name)) {
        alert('Character already exists');
        return;
    }

    // Save state for undo
    saveStateForUndo();

    appState.characters.push({
        name,
        canonicalName: name,
        aliases: [],
        count: 0,
        isAlias: false
    });
    input.value = '';
    updateTopCharacters();
    renderCharacterList();
    saveToLocalStorage();
}

function moveCharacter(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= appState.characters.length) return;

    // Save state for undo
    saveStateForUndo();

    // Swap characters
    const temp = appState.characters[index];
    appState.characters[index] = appState.characters[newIndex];
    appState.characters[newIndex] = temp;

    updateTopCharacters();
    renderCharacterList();
    saveToLocalStorage();
}

function editCharacterName(index) {
    const char = appState.characters[index];
    const newName = prompt(`Edit character name:`, char.name);

    if (!newName || newName.trim() === '') return; // User cancelled or empty
    if (newName === char.name) return; // No change

    // Check if new name already exists
    if (appState.characters.some(c => c.name === newName.trim())) {
        alert('A character with that name already exists.');
        return;
    }

    // Save state for undo
    saveStateForUndo();

    // Update the character name
    appState.characters[index].name = newName.trim();

    updateTopCharacters();
    renderCharacterList();
    saveToLocalStorage();
}

function deleteCharacter(index) {
    const char = appState.characters[index];

    // Prevent deleting "(Other)"
    if (char.name === '(Other)') {
        alert('Cannot delete the special "(Other)" category.');
        return;
    }

    const confirmDelete = confirm(`Delete character "${char.name}"?\n\nThis will remove it from the list but won't affect already-annotated lines.`);
    if (!confirmDelete) return;

    // Save state for undo
    saveStateForUndo();

    // Remove the character
    appState.characters.splice(index, 1);

    updateTopCharacters();
    renderCharacterList();
    saveToLocalStorage();
}

function sortCharactersByFrequency() {
    // Count how many characters have non-zero counts
    const withCounts = appState.characters.filter(c => c.count > 0 && c.name !== '(Other)').length;

    if (withCounts === 0) {
        alert('No characters have dialogue counts to sort by.\n\nCounts are based on pre-filled characters from the subtitle file.');
        return;
    }

    // Separate (Other) from the rest
    const otherIndex = appState.characters.findIndex(c => c.name === '(Other)');
    let other = null;
    if (otherIndex !== -1) {
        other = appState.characters.splice(otherIndex, 1)[0];
    }

    // Sort remaining characters by count (descending), then alphabetically for ties
    appState.characters.sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
    });

    // Put (Other) back at the beginning
    if (other) {
        appState.characters.unshift(other);
    }

    updateTopCharacters();
    renderCharacterList();
    saveToLocalStorage();
}

function exportCharacterList() {
    const defaultName = appState.filename
        ? appState.filename.replace(/\.(srt|ass)$/i, '-characters.json')
        : 'character-list.json';

    const filename = prompt('Enter filename for character list:', defaultName);
    if (!filename) return; // User cancelled

    // Export only non-alias characters with their alias information
    const characterList = appState.characters
        .filter(c => !c.isAlias)
        .map(c => ({
            name: c.name,
            canonicalName: c.canonicalName || c.name,
            aliases: c.aliases || []
        }));

    const blob = new Blob([JSON.stringify(characterList, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.json') ? filename : filename + '.json';
    a.click();
    URL.revokeObjectURL(url);

    // Also save to localStorage as global list
    localStorage.setItem('global-character-list', JSON.stringify(characterList));
}

function importCharacterList(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);

            if (!Array.isArray(imported)) {
                alert('Invalid character list format');
                return;
            }

            // Build alias-to-canonical mapping from imported list
            const aliasMap = {};
            imported.forEach(importedChar => {
                if (importedChar.aliases && importedChar.aliases.length > 0) {
                    importedChar.aliases.forEach(alias => {
                        aliasMap[alias] = importedChar.canonicalName || importedChar.name;
                    });
                }
            });

            // Update existing characters that match aliases to use canonical names
            appState.characters.forEach(existingChar => {
                if (aliasMap[existingChar.name]) {
                    const canonicalName = aliasMap[existingChar.name];
                    // Update subtitles to use canonical name
                    appState.subtitles.forEach(sub => {
                        if (sub.character === existingChar.name) {
                            sub.character = canonicalName;
                        }
                    });
                    // Mark this character for removal (will be handled below)
                    existingChar._shouldRemove = true;
                }
            });

            // Remove characters that were aliases
            appState.characters = appState.characters.filter(c => !c._shouldRemove);

            // Merge imported list with existing characters
            imported.forEach(importedChar => {
                const existing = appState.characters.find(c => c.name === importedChar.name);
                if (!existing) {
                    // Add new character (count will be recalculated from subtitles)
                    const count = appState.subtitles.filter(s => s.character === importedChar.name).length;
                    appState.characters.push({
                        name: importedChar.name,
                        canonicalName: importedChar.canonicalName || importedChar.name,
                        aliases: importedChar.aliases || [],
                        count: count,
                        isAlias: false
                    });
                } else {
                    // Update existing character with alias information
                    existing.canonicalName = importedChar.canonicalName || importedChar.name;
                    existing.aliases = importedChar.aliases || [];
                    // Recalculate count from subtitles
                    existing.count = appState.subtitles.filter(s => s.character === existing.name).length;
                }
            });

            // Reorder to match imported list (put imported characters first, in order)
            const reordered = [];
            imported.forEach(importedChar => {
                const char = appState.characters.find(c => c.name === importedChar.name);
                if (char) {
                    reordered.push(char);
                }
            });
            // Add any characters not in the imported list (and not aliases)
            appState.characters.forEach(char => {
                if (!reordered.includes(char) && !aliasMap[char.name]) {
                    reordered.push(char);
                }
            });
            appState.characters = reordered;

            updateTopCharacters();
            renderCharacterList();
            saveToLocalStorage();

            alert('Character list imported successfully!');
        } catch (err) {
            alert('Error importing character list: ' + err.message);
        }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

function editCharacters() {
    document.getElementById('annotationWorkspace').style.display = 'none';
    document.getElementById('characterManagement').style.display = 'block';
    renderCharacterList();
}

function startAnnotating() {
    // Check if there's at least one non-alias character
    if (appState.characters.filter(c => !c.isAlias).length === 0) {
        alert('Please add at least one character before annotating');
        return;
    }

    // Reset filter when starting annotation (unless already in annotation mode)
    if (document.getElementById('annotationWorkspace').style.display === 'none') {
        currentFilter = 'all';
    }

    document.getElementById('characterManagement').style.display = 'none';
    document.getElementById('annotationWorkspace').style.display = 'block';

    renderAnnotationWorkspace();
}
