import { calculateDistribution, suggestChipValues, suggestBlinds, formatCurrency } from './chipCalculator.js';
import {
    saveChips, loadChips, saveGameSettings, loadGameSettings,
    getPresets, savePreset, deletePreset, loadPreset,
    getDefaultChips, getDefaultGameSettings
} from './storage.js';

// ===== State =====
let chips = [];
let gameSettings = getDefaultGameSettings();
let editingChipId = null; // null = add mode, string = edit mode

// ===== DOM Elements =====
const elements = {
    // Game setup
    buyIn: document.getElementById('buy-in'),
    players: document.getElementById('players'),
    smallBlind: document.getElementById('small-blind'),
    bigBlind: document.getElementById('big-blind'),
    suggestedBuyIn: document.getElementById('suggested-buyin'),

    // Chip inventory
    chipList: document.getElementById('chip-list'),
    addChipBtn: document.getElementById('add-chip-btn'),

    // Calculate
    calculateBtn: document.getElementById('calculate-btn'),

    // Results
    resultsSection: document.getElementById('results'),
    distributionList: document.getElementById('distribution-list'),
    resultsTotal: document.getElementById('results-total'),
    resultsWarnings: document.getElementById('results-warnings'),

    // Presets
    presetList: document.getElementById('preset-list'),
    presetName: document.getElementById('preset-name'),
    savePresetBtn: document.getElementById('save-preset-btn'),

    // Modal
    addChipModal: document.getElementById('add-chip-modal'),
    chipModalTitle: document.getElementById('chip-modal-title'),
    newChipColor: document.getElementById('new-chip-color'),
    newChipQuantity: document.getElementById('new-chip-quantity'),
    newChipValue: document.getElementById('new-chip-value'),
    cancelAddChip: document.getElementById('cancel-add-chip'),
    confirmAddChip: document.getElementById('confirm-add-chip')
};

// ===== Initialization =====
function init() {
    // Load saved state or use defaults
    const savedChips = loadChips();
    const savedSettings = loadGameSettings();

    chips = savedChips || getDefaultChips();
    if (savedSettings) {
        gameSettings = savedSettings;
    }

    // Populate UI
    updateGameSettingsUI();
    updateSuggestedBuyIn();
    renderChipList();
    renderPresetList();

    // Event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Game settings inputs
    elements.buyIn.addEventListener('change', handleBuyInChange);
    elements.players.addEventListener('change', handleGameSettingsChange);
    elements.smallBlind.addEventListener('change', handleSmallBlindChange);
    elements.bigBlind.addEventListener('change', handleBigBlindChange);

    // Calculate button
    elements.calculateBtn.addEventListener('click', handleCalculate);

    // Chip inventory
    elements.addChipBtn.addEventListener('click', openAddChipModal);

    // Modal
    elements.cancelAddChip.addEventListener('click', closeAddChipModal);
    elements.confirmAddChip.addEventListener('click', handleSaveChip);
    elements.addChipModal.addEventListener('click', (e) => {
        if (e.target === elements.addChipModal) closeAddChipModal();
    });

    // Presets
    elements.savePresetBtn.addEventListener('click', handleSavePreset);
}

// ===== Game Settings =====
function updateGameSettingsUI() {
    elements.buyIn.value = gameSettings.buyIn;
    elements.players.value = gameSettings.players;
    elements.smallBlind.value = gameSettings.smallBlind;
    elements.bigBlind.value = gameSettings.bigBlind;
}

function handleGameSettingsChange() {
    gameSettings = {
        buyIn: parseFloat(elements.buyIn.value) || 50,
        players: parseInt(elements.players.value) || 6,
        smallBlind: parseFloat(elements.smallBlind.value) || 0.50,
        bigBlind: parseFloat(elements.bigBlind.value) || 1
    };
    saveGameSettings(gameSettings);
    updateSuggestedBuyIn();

    // Hide results when settings change
    elements.resultsSection.classList.add('hidden');
}

function handleBuyInChange() {
    const buyIn = parseFloat(elements.buyIn.value) || 50;

    // Auto-suggest optimal blinds based on buy-in
    const suggested = suggestBlinds(buyIn);
    elements.smallBlind.value = suggested.smallBlind;
    elements.bigBlind.value = suggested.bigBlind;

    // Update game settings with new values
    handleGameSettingsChange();
}

function handleSmallBlindChange() {
    const sb = parseFloat(elements.smallBlind.value) || 0.50;
    // Auto-populate big blind as 2× small blind
    elements.bigBlind.value = sb * 2;
    handleGameSettingsChange();
}

function handleBigBlindChange() {
    const bb = parseFloat(elements.bigBlind.value) || 1;
    // Auto-populate small blind as 0.5× big blind
    elements.smallBlind.value = bb / 2;
    handleGameSettingsChange();
}

function updateSuggestedBuyIn() {
    const suggestedValue = gameSettings.bigBlind * 100;
    elements.suggestedBuyIn.textContent = `💡 Suggested buy-in: ${formatCurrency(suggestedValue)} (100× Big Blind)`;
}

// ===== Chip List =====
function renderChipList() {
    if (chips.length === 0) {
        elements.chipList.innerHTML = `
      <div class="preset-empty">
        No chips added yet. Click + to add chip types.
      </div>
    `;
        return;
    }

    elements.chipList.innerHTML = chips.map(chip => `
    <div class="chip-item" data-id="${chip.id}">
      <div class="chip-icon" style="background-color: ${chip.color}"></div>
      <div class="chip-details">
        <span class="chip-name">${chip.name}</span>
        <span class="chip-info">${chip.quantity} chips • <span class="chip-value">${formatCurrency(chip.value)}</span></span>
      </div>
      <button class="btn-delete" data-id="${chip.id}" title="Remove">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `).join('');

    // Add click handlers for editing
    elements.chipList.querySelectorAll('.chip-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete')) return;
            const id = item.dataset.id;
            const chip = chips.find(c => c.id === id);
            if (chip) openEditChipModal(chip);
        });
    });

    // Add delete handlers
    elements.chipList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            chips = chips.filter(c => c.id !== id);
            saveChips(chips);
            renderChipList();
            elements.resultsSection.classList.add('hidden');
        });
    });
}

// ===== Chip Modal (Add/Edit) =====
function openAddChipModal() {
    editingChipId = null;
    elements.chipModalTitle.textContent = 'Add Chip Type';
    elements.confirmAddChip.textContent = 'Add Chip';
    elements.newChipColor.value = '#FFFFFF';
    elements.newChipColor.disabled = false;
    elements.newChipQuantity.value = 100;
    elements.newChipValue.value = '';
    elements.addChipModal.classList.remove('hidden');
}

function openEditChipModal(chip) {
    editingChipId = chip.id;
    elements.chipModalTitle.textContent = `Edit ${chip.name} Chip`;
    elements.confirmAddChip.textContent = 'Save Changes';
    elements.newChipColor.value = chip.color;
    elements.newChipColor.disabled = true; // Can't change color when editing
    elements.newChipQuantity.value = chip.quantity;
    elements.newChipValue.value = chip.value;
    elements.addChipModal.classList.remove('hidden');
}

function closeAddChipModal() {
    elements.addChipModal.classList.add('hidden');
    editingChipId = null;
}

function handleSaveChip() {
    const colorOption = elements.newChipColor.selectedOptions[0];
    const color = elements.newChipColor.value;
    const name = colorOption.dataset.name;
    const quantity = parseInt(elements.newChipQuantity.value) || 100;
    const value = parseFloat(elements.newChipValue.value) || 0;

    if (editingChipId) {
        // Edit existing chip
        const chip = chips.find(c => c.id === editingChipId);
        if (chip) {
            chip.quantity = quantity;
            chip.value = value > 0 ? value : chip.value; // Keep old value if not specified
        }
    } else {
        // Add new chip
        const id = Date.now().toString();

        // Check if color already exists
        const existingIndex = chips.findIndex(c => c.color === color);
        if (existingIndex >= 0) {
            // Update existing
            chips[existingIndex].quantity = quantity;
            if (value > 0) chips[existingIndex].value = value;
        } else {
            // Add new
            chips.push({
                id,
                color,
                name,
                quantity,
                value: value > 0 ? value : 1
            });
        }
    }

    // Sort by value
    chips.sort((a, b) => a.value - b.value);

    saveChips(chips);
    renderChipList();
    closeAddChipModal();
    elements.resultsSection.classList.add('hidden');
}

// ===== Calculate Distribution =====
function handleCalculate() {
    // Auto-apply optimal chip values before calculating
    if (chips.length > 0) {
        const suggestedValues = suggestChipValues(gameSettings.smallBlind, gameSettings.buyIn, chips.length);
        const sortedChips = [...chips].sort((a, b) => a.value - b.value);

        sortedChips.forEach((chip, index) => {
            if (index < suggestedValues.length) {
                const originalChip = chips.find(c => c.id === chip.id);
                if (originalChip) {
                    originalChip.value = suggestedValues[index];
                }
            }
        });

        chips.sort((a, b) => a.value - b.value);
        saveChips(chips);
        renderChipList();
    }

    const result = calculateDistribution({
        buyIn: gameSettings.buyIn,
        smallBlind: gameSettings.smallBlind,
        bigBlind: gameSettings.bigBlind,
        numPlayers: gameSettings.players,
        chips
    });

    renderResults(result);
}

function renderResults({ distribution, totalValue, totalChips, isValid, warnings }) {
    // Show results section
    elements.resultsSection.classList.remove('hidden');

    // Render distribution
    if (distribution.length === 0) {
        elements.distributionList.innerHTML = `
      <div class="preset-empty">No chips available for distribution</div>
    `;
    } else {
        elements.distributionList.innerHTML = distribution.map(item => `
      <div class="distribution-item">
        <div class="chip-icon" style="background-color: ${item.color}"></div>
        <span class="distribution-quantity">${item.quantity}</span>
        <span class="distribution-math">× ${formatCurrency(item.value)}</span>
        <span class="distribution-subtotal">= ${formatCurrency(item.subtotal)}</span>
      </div>
    `).join('');
    }

    // Render total with chip count
    const validClass = isValid ? 'valid' : 'invalid';
    elements.resultsTotal.className = `results-total ${validClass}`;
    const chipCountInfo = totalChips ? ` (${totalChips} chips)` : '';
    elements.resultsTotal.innerHTML = `
    <span>Total${chipCountInfo}:</span>
    <span>${formatCurrency(totalValue)} ${isValid ? '✓' : '⚠️'}</span>
  `;

    // Render warnings
    if (warnings.length > 0) {
        elements.resultsWarnings.innerHTML = warnings.map(w => `
      <div class="warning-item">⚠️ ${w}</div>
    `).join('');
    } else {
        elements.resultsWarnings.innerHTML = '';
    }

    // Scroll to results
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Presets =====
function renderPresetList() {
    const presets = getPresets();

    if (presets.length === 0) {
        elements.presetList.innerHTML = `
      <div class="preset-empty">No saved presets. Save your chip configuration for quick access.</div>
    `;
        return;
    }

    elements.presetList.innerHTML = presets.map(preset => `
    <div class="preset-item" data-id="${preset.id}">
      <div>
        <div class="preset-name">${preset.name}</div>
        <div class="preset-chips">${preset.chips.length} chip types • ${formatCurrency(preset.gameSettings.buyIn)} buy-in</div>
      </div>
      <button class="btn-delete" data-id="${preset.id}" title="Delete">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `).join('');

    // Add click handlers
    elements.presetList.querySelectorAll('.preset-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete')) return;
            const preset = loadPreset(item.dataset.id);
            if (preset) {
                chips = preset.chips;
                gameSettings = preset.gameSettings;
                saveChips(chips);
                saveGameSettings(gameSettings);
                updateGameSettingsUI();
                renderChipList();
                elements.resultsSection.classList.add('hidden');
            }
        });
    });

    // Add delete handlers
    elements.presetList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePreset(btn.dataset.id);
            renderPresetList();
        });
    });
}

function handleSavePreset() {
    const name = elements.presetName.value.trim();
    if (!name) {
        elements.presetName.focus();
        elements.presetName.style.borderColor = 'var(--color-error)';
        setTimeout(() => {
            elements.presetName.style.borderColor = '';
        }, 2000);
        return;
    }

    savePreset(name, chips, gameSettings);
    elements.presetName.value = '';
    renderPresetList();

    // Visual feedback
    elements.savePresetBtn.textContent = '✓ Saved!';
    setTimeout(() => {
        elements.savePresetBtn.textContent = 'Save Current';
    }, 1500);
}

// ===== Start App =====
init();
