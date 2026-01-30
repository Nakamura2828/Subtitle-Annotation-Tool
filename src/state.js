// Global state
let appState = {
    filename: '',
    subtitles: [],
    characters: [],
    topCharacters: [],
    sceneBreaks: [] // Array of line indices where scene breaks occur
};

// UI state for expandable alias sections (not persisted)
let aliasExpandedState = {};

// Filter state for annotation workspace
let currentFilter = 'all'; // 'all', 'unannotated', or character name

// Undo/Redo stacks
let undoStack = [];
let redoStack = [];
const MAX_UNDO_STATES = 50; // Limit stack size to prevent memory issues
