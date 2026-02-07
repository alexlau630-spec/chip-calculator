/**
 * Chip Distribution Calculator
 * Calculates optimal chip distribution for poker games
 */

/**
 * Calculate optimal chip values based on small blind
 * Prefers integer values for easy memorization.
 * If blinds are fractional, dedicates 2 chip colors to handle them.
 * 
 * @param {number} smallBlind - The small blind amount
 * @param {number} numChipTypes - Number of different chip types available
 * @returns {number[]} - Array of suggested chip values
 */
export function suggestChipValues(smallBlind, numChipTypes) {
    const values = [];
    const isIntegerBlind = smallBlind % 1 === 0;

    if (isIntegerBlind) {
        // Integer blinds: use clean multipliers of small blind
        // e.g., SB=1 -> 1, 2, 5, 10, 25, 100
        const multipliers = [1, 2, 5, 10, 25, 100, 500, 1000];
        for (let i = 0; i < Math.min(numChipTypes, multipliers.length); i++) {
            values.push(smallBlind * multipliers[i]);
        }
    } else {
        // Fractional blinds: dedicate first 2 chips to blind values,
        // then use integer values for the rest
        // e.g., SB=0.25 -> 0.25, 0.50, 1, 5, 25, 100

        // First chip = small blind
        values.push(smallBlind);

        // Second chip = big blind (2x small blind)
        if (numChipTypes >= 2) {
            values.push(smallBlind * 2);
        }

        // Remaining chips: use clean integer values
        const integerValues = [1, 5, 25, 100, 500, 1000];
        let intIdx = 0;

        // Start from an integer >= big blind
        const bigBlind = smallBlind * 2;
        while (intIdx < integerValues.length && integerValues[intIdx] <= bigBlind) {
            intIdx++;
        }

        for (let i = 2; i < numChipTypes && intIdx < integerValues.length; i++) {
            values.push(integerValues[intIdx]);
            intIdx++;
        }
    }

    return values;
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
        // Three or more chip types: USE ALL COLORS
        // Goal: Distribute value across all chip types, ensuring each color is represented
        // CRITICAL: Always allocate smallest chips FIRST for blind payments

        const allocations = new Map();

        // Initialize all chips with 0
        sortedChips.forEach(chip => allocations.set(chip.id, 0));

        // FIRST: Allocate smallest chips (for blind payments)
        // Give at least 10-20 of the smallest denomination
        const smallest = sortedChips[0];
        const smallestMaxQty = Math.floor(smallest.quantity / numPlayers);
        const smallestTargetQty = Math.min(20, smallestMaxQty, Math.floor(remainingValue / smallest.value));
        allocations.set(smallest.id, smallestTargetQty);
        remainingValue -= smallestTargetQty * smallest.value;

        // SECOND: Allocate second-smallest chips
        if (sortedChips.length >= 2 && remainingValue > 0) {
            const secondSmallest = sortedChips[1];
            const secondMaxQty = Math.floor(secondSmallest.quantity / numPlayers);
            const secondTargetQty = Math.min(10, secondMaxQty, Math.floor(remainingValue / secondSmallest.value));
            if (secondTargetQty > 0) {
                allocations.set(secondSmallest.id, secondTargetQty);
                remainingValue -= secondTargetQty * secondSmallest.value;
            }
        }

        // THIRD: Allocate to larger chips (from largest down)
        // Give each a minimum of 2-4 chips to ensure all colors are used
        for (let i = sortedChips.length - 1; i >= 2 && remainingValue > 0; i--) {
            const chip = sortedChips[i];
            const maxQty = Math.floor(chip.quantity / numPlayers);
            const maxFromValue = Math.floor(remainingValue / chip.value);

            // Target: 2-4 chips per color
            const targetQty = (i === sortedChips.length - 1) ? 2 : 4;
            const qty = Math.min(targetQty, maxQty, maxFromValue);

            if (qty > 0) {
                allocations.set(chip.id, qty);
                remainingValue -= qty * chip.value;
            }
        }

        // FOURTH: If any value remains, add more smallest chips
        if (remainingValue > 0) {
            const currentSmallest = allocations.get(smallest.id);
            const additionalQty = Math.min(
                Math.round(remainingValue / smallest.value),
                smallestMaxQty - currentSmallest
            );
            if (additionalQty > 0) {
                allocations.set(smallest.id, currentSmallest + additionalQty);
                remainingValue -= additionalQty * smallest.value;
            }
        }

        // FIFTH: Ensure all colors have at least 2 chips (swap from smallest if needed)
        for (let i = 2; i < sortedChips.length; i++) {
            const chip = sortedChips[i];
            if (allocations.get(chip.id) === 0) {
                const smallestQty = allocations.get(smallest.id);
                const swapQty = 2;
                const valueNeeded = swapQty * chip.value;
                const smallChipsToRemove = Math.ceil(valueNeeded / smallest.value);

                if (smallestQty >= smallChipsToRemove + 8) { // Keep at least 8 smallest
                    allocations.set(chip.id, swapQty);
                    allocations.set(smallest.id, smallestQty - smallChipsToRemove);
                }
            }
        }

        // Build distribution from allocations (sorted by value)
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
