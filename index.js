/**
 * @file This file contains the core logic for Ranked Choice Voting (RCV) and is intended to be a pure, dependency-free module.
 * @copyright 2025 Destin L. Mincy. All Rights Reserved.
 * @license Apache 2.0 + Commons Clause
 * @author Destin L. Mincy
 */

// -----------------------------------------------------------------------------
// Helper Functions (Internal)
// -----------------------------------------------------------------------------

/**
 * Finds the first-choice vote on a ballot that is still active.
 * @param {string[]} ballot - A single voter's ranked ballot.
 * @param {Set<string>} activeOptions - A Set of options still in the running.
 * @returns {string|null} - The highest-ranked active option, or null.
 */
function getActiveChoice(ballot, activeOptions) {
  for (const choice of ballot) {
    if (activeOptions.has(choice)) {
      return choice;
    }
  }
  return null;
}

/**
 * Finds the next-highest active choice for vote transfer.
 * @param {string[]} ballot - A single voter's ranked ballot.
 * @param {Set<string>} activeOptions - A Set of options still in the running.
 * @returns {string|null} - The next highest-ranked active option, or null.
 */
function getTransferChoice(ballot, activeOptions) {
  // This is identical to getActiveChoice, but named for clarity in the tally function.
  return getActiveChoice(ballot, activeOptions);
}

// -----------------------------------------------------------------------------
// Exported Functions
// -----------------------------------------------------------------------------

/**
 * Validates a single ballot against a list of official options and returns an object.
 *
 * @param {string[]} ballot - A voter's ranked choices, e.g., ['option_A', 'option_C'].
 * @param {string[]} options - The official list of all valid options, e.g., ['option_A', 'option_B', 'option_C'].
 * @returns {{valid: boolean, error: string|null}} - An object indicating validity.
 */
function validateVote(ballot, options) {
  if (!ballot || !Array.isArray(ballot)) {
    return { valid: false, error: "Ballot is null or not an array." };
  }
  if (!options || !Array.isArray(options)) {
    return { valid: false, error: "options list is null or not an array." };
  }

  const optionset = new Set(options);
  for (const choice of ballot) {
    if (!optionset.has(choice)) {
      return {
        valid: false,
        
        error: `Invalid choice: "${choice}" is not one of the options.`,
      };
    }
  }

  const ballotSet = new Set(ballot);
  if (ballotSet.size !== ballot.length) {
    return {
      valid: false,
      error: "Duplicate found: ballot contains repeated option rankings.",
    };
  }

  return { valid: true, error: null };
}

/**
 * Sanitizes and formats the raw vote data into a clean array of ballots.
 *
 * @param {object[]} rawVotes - An array of vote objects. Each object must have a `rankings` property that is an array of strings.
 * @param {string[]} options - The official list of all valid options.
 * @returns {string[][]} - A clean array of valid ballots, e.g., [['A', 'C'], ...].
 */
function formatBallots(rawVotes, options) {
  const cleanBallots = [];
  if (!rawVotes || !Array.isArray(rawVotes)) {
    return [];
  }

  for (const vote of rawVotes) {
    if (!vote || typeof vote !== "object" || !Array.isArray(vote.rankings)) {
      continue;
    }

    const ballot = vote.rankings;
    const validation = validateVote(ballot, options);

    if (validation.valid) {
      cleanBallots.push(ballot);
    } else {
      console.warn(`Invalid ballot skipped: ${validation.error}`);
    }
  }

  return cleanBallots;
}

/**
 * Runs the full round-by-round RCV simulation.
 *
 * @param {string[][]} ballots - A *clean* array of ballots, as returned by `formatBallots()`.
 * @param {string[]} options - The official list of all valid options.
 * @param {object} config - An object specifying the rules for the election.
 * @param {string} config.tieBreaking - How to handle ties for elimination (e.g., 'eliminate_all').
 * @param {number} config.maxRounds - A safety limit to prevent infinite loops (e.g., 20).
 * @returns {object} - A detailed, round-by-round results object.
 */
function tally(ballots, options, config) {
  const totalVotes = ballots.length;
  const threshold = Math.floor(totalVotes / 2) + 1;
  const roundLogs = [];

  let activeOptions = new Set(options);
  let currentBallotChoices = ballots.map((ballot) =>
    getActiveChoice(ballot, activeOptions)
  );

  for (let round = 1; round <= config.maxRounds; round++) {
    const roundTally = new Map();
    const roundLog = {
      round: round,
      tally: {},
      status: "",
      eliminated: [],
      transfers: {},
    };

    for (const option of activeOptions) {
      roundTally.set(option, 0);
    }

    for (const choice of currentBallotChoices) {
      if (choice) {
        roundTally.set(choice, roundTally.get(choice) + 1);
      }
    }

    roundTally.forEach((count, option) => {
      roundLog.tally[option] = count;
    });

    for (const [option, count] of roundTally.entries()) {
      if (count >= threshold) {
        roundLog.status = "Winner found";
        roundLogs.push(roundLog);
        return {
          winner: option,
          totalVotes: totalVotes,
          threshold: threshold,
          options: options,
          rounds: roundLogs,
        };
      }
    }

    let minVotes = Infinity;
    for (const [option, count] of roundTally.entries()) {
      if (count < minVotes) {
        minVotes = count;
      }
    }

    const toEliminate = [];
    for (const [option, count] of roundTally.entries()) {
      if (count === minVotes) {
        toEliminate.push(option);
      }
    }

    if (toEliminate.length === activeOptions.size) {
      roundLog.status = "Unbreakable tie";
      roundLog.eliminated = toEliminate;
      roundLogs.push(roundLog);
      return {
        winner: null,
        totalVotes: totalVotes,
        threshold: threshold,
        options: options,
        rounds: roundLogs,
      };
    }

    roundLog.status = "Elimination";
    roundLog.eliminated = toEliminate;
    const eliminatedSet = new Set(toEliminate);

    for (const option of eliminatedSet) {
      activeOptions.delete(option);
    }

    const newBallotChoices = [];
    for (let i = 0; i < ballots.length; i++) {
      const originalBallot = ballots[i];
      const currentChoice = currentBallotChoices[i];

      if (currentChoice && eliminatedSet.has(currentChoice)) {
        const nextChoice = getTransferChoice(originalBallot, activeOptions);

        if (!roundLog.transfers[currentChoice]) {
          roundLog.transfers[currentChoice] = {};
        }

        const target = nextChoice || "exhausted";

        if (!roundLog.transfers[currentChoice][target]) {
          roundLog.transfers[currentChoice][target] = 0;
        }
        roundLog.transfers[currentChoice][target]++;

        newBallotChoices.push(nextChoice);
      } else {
        newBallotChoices.push(currentChoice);
      }
    }

    currentBallotChoices = newBallotChoices;
    roundLogs.push(roundLog);
  }

  return {
    winner: null,
    totalVotes: totalVotes,
    threshold: threshold,
    options: options,
    rounds: roundLogs,
    error: `Tally exceeded max rounds (${config.maxRounds}).`,
  };
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
  validateVote,
  formatBallots,
  tally,
};
