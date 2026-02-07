/**
 * Local Storage wrapper for presets and settings
 */

const STORAGE_KEYS = {
    CHIPS: 'poker-chip-calculator-chips',
    PRESETS: 'poker-chip-calculator-presets',
    GAME_SETTINGS: 'poker-chip-calculator-game'
};

/**
 * Save chip inventory to local storage
 * @param {Array} chips - Array of chip objects
 */
export function saveChips(chips) {
    try {
        localStorage.setItem(STORAGE_KEYS.CHIPS, JSON.stringify(chips));
    } catch (e) {
        console.error('Failed to save chips:', e);
    }
}

/**
 * Load chip inventory from local storage
 * @returns {Array|null} - Array of chip objects or null if not found
 */
export function loadChips() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.CHIPS);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Failed to load chips:', e);
        return null;
    }
}

/**
 * Save game settings to local storage
 * @param {Object} settings - Game settings object
 */
export function saveGameSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEYS.GAME_SETTINGS, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save game settings:', e);
    }
}

/**
 * Load game settings from local storage
 * @returns {Object|null} - Game settings or null if not found
 */
export function loadGameSettings() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.GAME_SETTINGS);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Failed to load game settings:', e);
        return null;
    }
}

/**
 * Get all saved presets
 * @returns {Array} - Array of preset objects
 */
export function getPresets() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.PRESETS);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Failed to load presets:', e);
        return [];
    }
}

/**
 * Save a new preset
 * @param {string} name - Preset name
 * @param {Array} chips - Chip configuration
 * @param {Object} gameSettings - Game settings
 * @returns {boolean} - Success status
 */
export function savePreset(name, chips, gameSettings) {
    try {
        const presets = getPresets();

        // Check for duplicate name
        const existingIndex = presets.findIndex(p => p.name === name);

        const preset = {
            id: existingIndex >= 0 ? presets[existingIndex].id : Date.now().toString(),
            name,
            chips,
            gameSettings,
            updatedAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            presets[existingIndex] = preset;
        } else {
            presets.push(preset);
        }

        localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
        return true;
    } catch (e) {
        console.error('Failed to save preset:', e);
        return false;
    }
}

/**
 * Delete a preset by ID
 * @param {string} id - Preset ID
 * @returns {boolean} - Success status
 */
export function deletePreset(id) {
    try {
        const presets = getPresets().filter(p => p.id !== id);
        localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
        return true;
    } catch (e) {
        console.error('Failed to delete preset:', e);
        return false;
    }
}

/**
 * Load a preset by ID
 * @param {string} id - Preset ID
 * @returns {Object|null} - Preset object or null if not found
 */
export function loadPreset(id) {
    const presets = getPresets();
    return presets.find(p => p.id === id) || null;
}

/**
 * Get default chip configuration for a new game
 * @returns {Array} - Default chip array
 */
export function getDefaultChips() {
    return [
        { id: '1', color: '#FFFFFF', name: 'White', quantity: 100, value: 0.50 },
        { id: '2', color: '#E53935', name: 'Red', quantity: 100, value: 1 },
        { id: '3', color: '#1E88E5', name: 'Blue', quantity: 50, value: 5 },
        { id: '4', color: '#212121', name: 'Black', quantity: 50, value: 25 }
    ];
}

/**
 * Get default game settings
 * @returns {Object} - Default game settings
 */
export function getDefaultGameSettings() {
    return {
        buyIn: 50,
        smallBlind: 0.50,
        bigBlind: 1,
        players: 6
    };
}
