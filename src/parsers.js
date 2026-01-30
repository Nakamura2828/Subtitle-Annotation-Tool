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
function parseASS(content) {
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
                const name = parts[4].trim();
                const text = parts.slice(9).join(',').replace(/\\N/g, ' ').trim();

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
