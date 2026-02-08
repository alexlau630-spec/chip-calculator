/**
 * Chip Distribution Calculator
 * Calculates optimal poker chip distributions
 */

/**
 * Suggest optimal chip values based on buy-in AND blind structure.
 * 
 * PRIORITIES:
 * 1. Values should allow hitting the exact buy-in
 * 2. Values should be easy to remember (clean integers)
 * 3. Smallest chip should be able to pay the small blind
 * 4. Largest chip should be reasonable (≤ buy-in / 2)
 * 
 * @param {number} smallBlind - The small blind amount
 * @param {number} buyIn - The buy-in amount
 * @param {number} numChipTypes - Number of different chip types available
 * @returns {number[]} - Array of suggested chip values
 */
export function suggestChipValues(smallBlind, buyIn, numChipTypes) {
    const values = [];
    const bigBlind = smallBlind * 2;

    // Fractional if EITHER blind is less than $1 (needs exact chip representation)
    const isFractionalBlind = smallBlind < 1 || bigBlind < 1;

    // Denomination pool (from smallest to largest)
    const allDenominations = [0.25, 0.50, 1, 2, 5, 10, 20, 25, 50, 100, 250, 500, 1000, 2500, 5000];

    if (isFractionalBlind) {
        // Fractional blinds: First 2 chips MUST be SB and BB exactly
        values.push(smallBlind);
        if (numChipTypes >= 2) {
            values.push(bigBlind);
        }

        // Remaining chips: pick from pool, starting above BB, up to buy-in/2
        const maxValue = Math.max(buyIn / 2, 1);
        const remaining = allDenominations.filter(d => d > bigBlind && d <= maxValue);

        for (let i = 2; i < numChipTypes && (i - 2) < remaining.length; i++) {
            values.push(remaining[i - 2]);
        }
    } else {
        // Integer blinds: Pick from pool based on buy-in range
        // Smallest should be ≤ small blind (or 1 if SB > 1)
        // Largest should be ≤ buy-in / 2

        const minValue = Math.min(smallBlind, 1); // At least $1 or smaller
        const maxValue = Math.max(buyIn / 2, smallBlind * 2);

        // Filter denominations to valid range
        let validDenoms = allDenominations.filter(d => d >= minValue && d <= maxValue && d % 1 === 0);

        // Ensure we have at least SB and BB representable
        if (validDenoms.length === 0) {
            validDenoms = [1, 5, 10, 25, 100]; // fallback
        }

        // Pick evenly spaced denominations to use all colors
        if (validDenoms.length <= numChipTypes) {
            // Use all valid denominations
            values.push(...validDenoms);
        } else {
            // Pick evenly spaced values
            const step = (validDenoms.length - 1) / (numChipTypes - 1);
            for (let i = 0; i < numChipTypes; i++) {
                const idx = Math.round(i * step);
                values.push(validDenoms[idx]);
            }
        }
    }

    // Ensure values are sorted and unique
    return [...new Set(values)].sort((a, b) => a - b);
}



/**
 * Calculate optimal chip distribution for each player
 * 
 * POKER PRINCIPLES:
 * 1. "100 Big Blind" Standard: Stack should be at least 100x big blind
 * 2. Efficient Stack: 20-30 chips total per person (not too many)
 * 3. Chip Ratios: ~50% smallest, ~40% medium, ~10% large denominations
 * 
 * @param {Object} params - Calculation parameters
 * @param {number} params.buyIn - Buy-in amount per player
 * @param {number} params.smallBlind - Small blind amount
 * @param {number} params.bigBlind - Big blind amount
 * @param {number} params.numPlayers - Number of players
 * @param {Array<{color: string, name: string, quantity: number, value: number}>} params.chips - Chip inventory
 * @returns {{distribution: Array, totalValue: number, isValid: boolean, warnings: string[], recommendation: object}}
 */
export function calculateDistribution({ buyIn, smallBlind, bigBlind, numPlayers, chips }) {
    const warnings = [];

    // Validate inputs
    if (!chips || chips.length === 0) {
        return { distribution: [], totalValue: 0, isValid: false, warnings: ['No chips defined'] };
    }

    if (buyIn <= 0) {
        return { distribution: [], totalValue: 0, isValid: false, warnings: ['Buy-in must be greater than 0'] };
    }

    // === POKER PRINCIPLE: 100 Big Blind Standard ===
    const minRecommendedStack = bigBlind * 100;
    if (buyIn < minRecommendedStack) {
        warnings.push(`Buy-in (${formatCurrency(buyIn)}) is less than 100 big blinds (${formatCurrency(minRecommendedStack)}). Consider increasing buy-in for better gameplay.`);
    }

    // Sort chips by value (ascending)
    const sortedChips = [...chips].sort((a, b) => a.value - b.value);

    // === POKER PRINCIPLE: Target 20-30 chips per player ===
    const targetTotalChips = 25; // Ideal middle ground
    const minChipsPerPlayer = 20;
    const maxChipsPerPlayer = 30;

    // === POKER PRINCIPLE: Chip distribution ratios ===
    // Based on the "Cash Game" example: 20 small (50%), 16 medium (40%), 4 large (10%)
    // We'll use these target ratios and adjust based on available chip types

    const distribution = [];
    let remainingValue = buyIn;

    if (sortedChips.length === 1) {
        // Only one chip type - simple division
        const chip = sortedChips[0];
        const quantity = Math.round(buyIn / chip.value);
        const maxFromInventory = Math.floor(chip.quantity / numPlayers);

        distribution.push({
            ...chip,
            quantity: Math.min(quantity, maxFromInventory),
            subtotal: Math.min(quantity, maxFromInventory) * chip.value
        });
    } else if (sortedChips.length === 2) {
        // Two chip types: 60% small, 40% large
        const [small, large] = sortedChips;

        // Target: ~15 small chips, rest in large
        const smallTarget = Math.min(15, Math.floor(buyIn * 0.5 / small.value));
        const smallQty = Math.min(smallTarget, Math.floor(small.quantity / numPlayers));
        const smallValue = smallQty * small.value;

        const largeQty = Math.min(
            Math.round((buyIn - smallValue) / large.value),
            Math.floor(large.quantity / numPlayers)
        );
        const largeValue = largeQty * large.value;

        // Adjust small to fill remainder
        const remainder = buyIn - smallValue - largeValue;
        const additionalSmall = Math.round(remainder / small.value);
        const finalSmallQty = smallQty + additionalSmall;

        if (finalSmallQty > 0) {
            distribution.push({ ...small, quantity: finalSmallQty, subtotal: finalSmallQty * small.value });
        }
        if (largeQty > 0) {
            distribution.push({ ...large, quantity: largeQty, subtotal: largeQty * large.value });
        }
    } else {
        // Three or more chip types: SMART PYRAMID ALGORITHM
        // 
        // Goals:
        // 1. Hit buy-in value exactly (or as close as possible)
        // 2. Pyramid structure: smallest chips = most quantity
        // 3. Use all colors if possible
        // 4. Reasonable total chip count (30-50)

        const allocations = new Map();
        sortedChips.forEach(chip => allocations.set(chip.id, 0));

        const n = sortedChips.length;
        const smallest = sortedChips[0];
        const smallestMaxQty = Math.floor(smallest.quantity / numPlayers);

        // STEP 1: Define pyramid target quantities (decreasing)
        const baseTargets = [25, 15, 10, 6, 4, 3, 2, 2, 2, 2];
        const targets = baseTargets.slice(0, n);

        // STEP 2: Calculate initial allocation and total value
        let totalValue = 0;
        for (let i = 0; i < n; i++) {
            const chip = sortedChips[i];
            const maxQty = Math.floor(chip.quantity / numPlayers);
            const qty = Math.min(targets[i], maxQty);
            allocations.set(chip.id, qty);
            totalValue += qty * chip.value;
        }

        // STEP 3: Adjust to hit buy-in
        if (totalValue > buyIn) {
            // OVER: Reduce from LARGEST chips first
            for (let i = n - 1; i >= 0 && totalValue > buyIn; i--) {
                const chip = sortedChips[i];
                let qty = allocations.get(chip.id);

                while (qty > 0 && totalValue > buyIn) {
                    if (totalValue - chip.value >= buyIn) {
                        qty--;
                        totalValue -= chip.value;
                    } else {
                        break;
                    }
                }
                allocations.set(chip.id, qty);
            }

            // Still over? Remove more aggressively
            for (let i = n - 1; i >= 1 && totalValue > buyIn; i--) {
                const chip = sortedChips[i];
                let qty = allocations.get(chip.id);

                while (qty > 0 && totalValue > buyIn) {
                    qty--;
                    totalValue -= chip.value;
                }
                allocations.set(chip.id, qty);
            }
        }

        // STEP 4: Fill remaining gap with SMALLEST chips
        if (totalValue < buyIn) {
            const gap = buyIn - totalValue;
            const currentSmallest = allocations.get(smallest.id);
            const additionalQty = Math.min(
                Math.ceil(gap / smallest.value),
                smallestMaxQty - currentSmallest
            );
            allocations.set(smallest.id, currentSmallest + additionalQty);
            totalValue += additionalQty * smallest.value;
        }

        // STEP 5: Ensure all colors have at least 2 chips
        for (let i = 1; i < n; i++) {
            const chip = sortedChips[i];
            const currentQty = allocations.get(chip.id);

            if (currentQty === 0) {
                const maxQty = Math.floor(chip.quantity / numPlayers);
                if (maxQty >= 2) {
                    const valueToAdd = 2 * chip.value;
                    const smallestQty = allocations.get(smallest.id);
                    const toRemove = Math.ceil(valueToAdd / smallest.value);

                    if (smallestQty >= toRemove + 10) {
                        allocations.set(chip.id, 2);
                        allocations.set(smallest.id, smallestQty - toRemove);
                    }
                }
            }
        }

        // STEP 6: Fine-tune to hit EXACT buy-in
        const currentTotal = sortedChips.reduce((sum, c) => sum + allocations.get(c.id) * c.value, 0);
        if (currentTotal < buyIn) {
            const gap = buyIn - currentTotal;
            const currentSmallest = allocations.get(smallest.id);
            const additionalQty = Math.min(
                Math.ceil(gap / smallest.value),
                smallestMaxQty - currentSmallest
            );
            if (additionalQty > 0) {
                allocations.set(smallest.id, currentSmallest + additionalQty);
            }
        }

        // Build distribution from allocations
        sortedChips.forEach(chip => {
            const qty = allocations.get(chip.id);
            if (qty > 0) {
                distribution.push({
                    ...chip,
                    quantity: qty,
                    subtotal: qty * chip.value
                });
            }
        });
    }

    // Calculate totals
    const totalValue = distribution.reduce((sum, chip) => sum + chip.subtotal, 0);
    const totalChips = distribution.reduce((sum, chip) => sum + chip.quantity, 0);
    const isValid = Math.abs(totalValue - buyIn) < 0.01;

    // === Validation Warnings ===

    // Check if total matches buy-in
    if (!isValid) {
        const diff = buyIn - totalValue;
        if (diff > 0) {
            warnings.push(`Short ${formatCurrency(diff)} - smallest chip denomination may be too large`);
        } else {
            warnings.push(`Over by ${formatCurrency(-diff)} - adjust chip values`);
        }
    }

    // Check chip count is in ideal range (only warn if too few)
    if (totalChips < minChipsPerPlayer) {
        warnings.push(`Only ${totalChips} chips per player. Consider smaller denominations for more flexibility.`);
    }

    // Check inventory constraints
    for (const chip of distribution) {
        const originalChip = chips.find(c => c.color === chip.color);
        const totalNeeded = chip.quantity * numPlayers;
        if (originalChip && totalNeeded > originalChip.quantity) {
            warnings.push(`Need ${totalNeeded} ${chip.name} chips but only have ${originalChip.quantity}`);
        }
    }

    // Check if smallest chip in INVENTORY works for blinds
    // (Not the smallest in distribution - check the actual available chips)
    const sortedInventory = [...chips].sort((a, b) => a.value - b.value);
    if (sortedInventory.length > 0) {
        const smallestAvailable = sortedInventory[0];
        if (smallestAvailable.value > smallBlind) {
            warnings.push(`Smallest chip (${formatCurrency(smallestAvailable.value)}) > small blind (${formatCurrency(smallBlind)}). Add smaller denomination.`);
        }
    }

    return {
        distribution,
        totalValue,
        totalChips,
        isValid,
        warnings,
        recommendation: {
            minStack: minRecommendedStack,
            idealChipCount: `${minChipsPerPlayer}-${maxChipsPerPlayer}`
        }
    };
}

/**
 * Format a number as currency
 * @param {number} value - The value to format
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(value) {
    if (value >= 1) {
        return `$${value.toFixed(value % 1 === 0 ? 0 : 2)}`;
    } else {
        return `$${value.toFixed(2)}`;
    }
}

/**
 * Validate and optimize chip values for a given game setup
 * @param {number} smallBlind - Small blind amount
 * @param {number} buyIn - Buy-in amount
 * @param {Array} chips - Current chip configuration
 * @returns {{isOptimal: boolean, suggestions: string[]}}
 */
export function validateChipValues(smallBlind, buyIn, chips) {
    const suggestions = [];

    if (chips.length === 0) {
        return { isOptimal: false, suggestions: ['Add at least one chip type'] };
    }

    const sortedChips = [...chips].sort((a, b) => a.value - b.value);
    const smallestValue = sortedChips[0].value;

    // Check if smallest chip works for blinds
    if (smallestValue > smallBlind) {
        suggestions.push(`Smallest chip ($${smallestValue}) is larger than small blind ($${smallBlind})`);
    }

    // Check if there's a chip close to small blind value
    const hasSmallBlindChip = sortedChips.some(c => c.value <= smallBlind * 2);
    if (!hasSmallBlindChip) {
        suggestions.push(`Consider a chip worth $${smallBlind} or $${smallBlind * 2} for blind bets`);
    }

    // Check for gaps in chip values
    for (let i = 1; i < sortedChips.length; i++) {
        const ratio = sortedChips[i].value / sortedChips[i - 1].value;
        if (ratio > 10) {
            suggestions.push(`Large gap between ${sortedChips[i - 1].name} and ${sortedChips[i].name} chips`);
        }
    }

    return {
        isOptimal: suggestions.length === 0,
        suggestions
    };
}
