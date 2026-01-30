// SRT Parser
function parseSRT(content) {
    const subtitles = [];
    const entries = content.split(/\n\s*\n/).filter(e => e.trim());

    entries.forEach(entry => {
        const lines = entry.split('\n');
        if (lines.length < 3) return;

        const index = parseInt(lines[0]);
        const timestamp = lines[1];
        const text = lines.slice(2).join('\n');

        // Extract character name from Japanese markers （）
        // Match anywhere in text, not just at start (handles 〈（Name）...〉 format)
        const characterMatch = text.match(/\uff08([^\uff09]+)\uff09/);
        let character = null;
        let isPrefilled = false;

        if (characterMatch) {
            character = characterMatch[1];
            isPrefilled = true;
        }

        subtitles.push({
            index,
            timestamp,
            text,
            character,
            isPrefilled
        });
    });

    return subtitles;
}

// ASS Parser
// allowedStyles: optional array of style names to include (e.g., ['Default', 'Default-ja'])
// If null/undefined, includes all dialogue lines (backward compatible)
function parseASS(content, allowedStyles = null) {
    const subtitles = [];
    const lines = content.split('\n');
    let inEvents = false;
    let index = 0;

    for (let line of lines) {
        if (line.includes('[Events]')) {
            inEvents = true;
            continue;
        }

        if (inEvents && line.startsWith('Dialogue:')) {
            // Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
            const parts = line.substring(9).split(',');

            if (parts.length >= 10) {
                const start = parts[1].trim();
                const end = parts[2].trim();
                const style = parts[3].trim();
                const name = parts[4].trim();
                const text = parts.slice(9).join(',').replace(/\\N/g, ' ').trim();

                // Filter by style if allowedStyles is provided
                if (allowedStyles !== null && !allowedStyles.includes(style)) {
                    continue; // Skip this line if style not allowed
                }

                // Skip non-dialogue styles (Opening, Ending, Signs, etc.)
                if (isNonDialogueStyle(style)) {
                    continue;
                }

                let character = null;
                let isPrefilled = false;

                // Try to get character from Name field first (English ASS)
                if (name && name !== '' && !isNonCharacterName(name)) {
                    character = name;
                    isPrefilled = true;
                } else {
                    // Try to extract from text markers (Japanese ASS)
                    // Match anywhere in text, not just at start (handles 〈（Name）...〉 format)
                    const characterMatch = text.match(/\uff08([^\uff09]+)\uff09/);
                    if (characterMatch) {
                        character = characterMatch[1];
                        isPrefilled = true;
                    }
                }

                subtitles.push({
                    index: index++,
                    timestamp: `${start} --> ${end}`,
                    text,
                    character,
                    isPrefilled
                });
            }
        }
    }

    return subtitles;
}

// Helper function to filter out non-dialogue ASS styles (Opening, Ending, Signs, etc.)
function isNonDialogueStyle(style) {
    const nonDialoguePatterns = [
        /^opening/i,
        /^ending/i,
        /^op/i,
        /^ed/i,
        /^signs?$/i,
        /romaji/i,
        /kanji/i,
        /english-english/i  // Song translations
    ];

    return nonDialoguePatterns.some(pattern => pattern.test(style));
}

// Helper function to filter out common non-character entries
function isNonCharacterName(name) {
    const nonCharacterPatterns = [
        /^signs/i,
        /^default/i,
        /^style/i,
        '足音', 'チャイム', 'ドアが開く', 'シャッターを押す',
        '♪', '・', '〈', '〉'
    ];

    return nonCharacterPatterns.some(pattern => {
        if (typeof pattern === 'string') {
            return name.includes(pattern);
        } else {
            return pattern.test(name);
        }
    });
}

// Strip ASS override tags from text (e.g., {\fad(150,255)}, {\be2}, {\pos(320,50)})
function stripASSCodes(text) {
    if (!text) return text;
    return text.replace(/\{\\[^}]*\}/g, '').trim();
}

// Timestamp utilities for alignment
function parseTimestamp(timestamp) {
    // Handles both SRT (00:00:01,000 --> 00:00:03,000) and ASS (0:00:01.00 --> 0:00:03.00) formats
    const parts = timestamp.split('-->').map(s => s.trim());
    if (parts.length !== 2) return null;

    const parseTime = (timeStr) => {
        // Handle both formats: "00:00:01,000" (SRT) and "0:00:01.00" (ASS)
        const normalized = timeStr.replace(',', '.');
        const match = normalized.match(/(\d+):(\d+):(\d+)\.?(\d+)?/);
        if (!match) return 0;

        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseInt(match[3]);
        const ms = match[4] ? parseInt(match[4].padEnd(3, '0').substring(0, 3)) : 0;

        return (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;
    };

    return {
        start: parseTime(parts[0]),
        end: parseTime(parts[1])
    };
}

function timestampsOverlap(timestamp1, timestamp2, tolerance = 500) {
    const t1 = parseTimestamp(timestamp1);
    const t2 = parseTimestamp(timestamp2);

    if (!t1 || !t2) return false;

    // Check if ranges overlap (with tolerance)
    // t1.start - tolerance <= t2.end AND t1.end + tolerance >= t2.start
    return (t1.start - tolerance <= t2.end) && (t1.end + tolerance >= t2.start);
}

// Align secondary subtitles to primary subtitles
// Returns primary array with secondaryText and secondaryIndices fields populated
function alignSubtitles(primarySubtitles, secondarySubtitles, tolerance = 500) {
    const aligned = primarySubtitles.map(primary => {
        // Find all secondary subtitles that overlap with this primary subtitle
        const overlapping = [];
        secondarySubtitles.forEach((secondary, secIdx) => {
            if (timestampsOverlap(primary.timestamp, secondary.timestamp, tolerance)) {
                overlapping.push({ text: secondary.text, index: secIdx });
            }
        });

        // Join multiple overlapping secondary lines with newline
        const secondaryText = overlapping.length > 0
            ? overlapping.map(s => s.text).join('\n')
            : null;

        // Store which secondary indices are linked (for shift operations)
        const secondaryIndices = overlapping.length > 0
            ? overlapping.map(s => s.index)
            : [];

        return {
            ...primary,
            secondaryText,
            secondaryIndices
        };
    });

    return aligned;
}
