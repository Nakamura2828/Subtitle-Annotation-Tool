// Global state
let appState = {
    filename: '',
    secondaryFilename: null, // v1.6: Secondary subtitle file name (null if none loaded)
    subtitles: [],
    characters: [],
    topCharacters: [],
    sceneBreaks: [], // Array of line indices where scene breaks occur
    hasSecondaryTrack: false, // v1.6: Boolean flag indicating if secondary track is loaded
    secondarySubtitles: [] // v1.6.1: Parsed secondary subtitle lines (preserved for manual re-linking)
};

// UI state for expandable alias sections (not persisted)
let aliasExpandedState = {};

// Filter state for annotation workspace
let currentFilter = 'all'; // 'all', 'unannotated', or character name
let currentSceneFilter = 'all'; // 'all' or character name (shows scenes where that character appears)

// Undo/Redo stacks
let undoStack = [];
let redoStack = [];
const MAX_UNDO_STATES = 50; // Limit stack size to prevent memory issues
