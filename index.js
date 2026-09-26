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
    if (typeof choice !== "string") {
      return {
        valid: false,
        error: `Invalid choice: ballot contains a non-string value.`,
      };
    }
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
 * @param {function(object, string): void} [onInvalid] - Optional callback invoked as `onInvalid(vote, error)` for each skipped vote.
 * @returns {string[][]} - A clean array of valid ballots, e.g., [['A', 'C'], ...].
 */
function formatBallots(rawVotes, options, onInvalid) {
  const cleanBallots = [];
  if (!rawVotes || !Array.isArray(rawVotes)) {
    return [];
  }

  for (const vote of rawVotes) {
    if (!vote || typeof vote !== "object" || !Array.isArray(vote.rankings)) {
      if (onInvalid) onInvalid(vote, "Vote is not an object with a rankings array.");
      continue;
    }

    const ballot = vote.rankings;
    const validation = validateVote(ballot, options);

    if (validation.valid) {
      cleanBallots.push(ballot);
    } else if (onInvalid) {
      onInvalid(vote, validation.error);
    }
  }

  return cleanBallots;
}

const TIE_BREAKING_RULES = ["eliminate_all", "previous_round"];

/**
 * Narrows a set of options tied for last place by looking back through earlier rounds,
 * most recent first, and keeping only those with the fewest votes in each.
 * @param {string[]} tied - Options tied for the fewest votes this round.
 * @param {object[]} previousRounds - Round logs for the rounds already completed.
 * @returns {string[]} - The options to eliminate; more than one if the tie never breaks.
 */
function breakTieByPreviousRounds(tied, previousRounds) {
  let remaining = tied;
  for (let i = previousRounds.length - 1; i >= 0 && remaining.length > 1; i--) {
    const pastTally = previousRounds[i].tally;
    const fewest = Math.min(...remaining.map((option) => pastTally[option]));
    remaining = remaining.filter((option) => pastTally[option] === fewest);
  }
  return remaining;
}

/**
 * Runs the full round-by-round RCV simulation.
 *
 * Each round, an option wins by holding a majority of the continuing (non-exhausted) ballots.
 *
 * @param {string[][]} ballots - A *clean* array of ballots, as returned by `formatBallots()`.
 * @param {string[]} options - The official list of all valid options.
 * @param {object} [config] - An object specifying the rules for the election.
 * @param {string} [config.tieBreaking] - How to handle ties for last place. `'eliminate_all'` (default) eliminates
 *   every tied option at once. `'previous_round'` eliminates whichever tied option had the fewest votes in the most
 *   recent earlier round that separates them, and falls back to eliminating all of them if none does.
 * @param {number} [config.maxRounds] - A safety limit to prevent infinite loops. Defaults to `options.length`,
 *   which is always enough since every round either finds a winner or eliminates at least one option.
 * @returns {object} - A detailed, round-by-round results object.
 */
function tally(ballots, options, config = {}) {
  const maxRounds = config.maxRounds ?? options.length;
  const tieBreaking = config.tieBreaking ?? "eliminate_all";
  if (!TIE_BREAKING_RULES.includes(tieBreaking)) {
    throw new Error(
      `Unknown tieBreaking rule "${tieBreaking}". Expected one of: ${TIE_BREAKING_RULES.join(", ")}.`
    );
  }

  const totalVotes = ballots.length;
  const roundLogs = [];
  let firstRoundThreshold = null;

  const result = (winner, extra = {}) => ({
    winner: winner,
    totalVotes: totalVotes,
    threshold: firstRoundThreshold,
    options: options,
    rounds: roundLogs,
    ...extra,
  });

  let activeOptions = new Set(options);
  let currentBallotChoices = ballots.map((ballot) =>
    getActiveChoice(ballot, activeOptions)
  );

  for (let round = 1; round <= maxRounds; round++) {
    const roundTally = new Map();
    const roundLog = {
      round: round,
      threshold: 0,
      exhausted: 0,
      tally: {},
      status: "",
      eliminated: [],
      transfers: {},
    };

    for (const option of activeOptions) {
      roundTally.set(option, 0);
    }

    let continuingVotes = 0;
    for (const choice of currentBallotChoices) {
      if (choice) {
        roundTally.set(choice, roundTally.get(choice) + 1);
        continuingVotes++;
      }
    }

    const threshold = Math.floor(continuingVotes / 2) + 1;
    if (round === 1) {
      firstRoundThreshold = threshold;
    }
    roundLog.threshold = threshold;
    roundLog.exhausted = totalVotes - continuingVotes;

    roundTally.forEach((count, option) => {
      roundLog.tally[option] = count;
    });

    for (const [option, count] of roundTally.entries()) {
      if (count >= threshold) {
        roundLog.status = "Winner found";
        roundLogs.push(roundLog);
        return result(option);
      }
    }

    let minVotes = Infinity;
    for (const count of roundTally.values()) {
      if (count < minVotes) {
        minVotes = count;
      }
    }

    let toEliminate = [];
    for (const [option, count] of roundTally.entries()) {
      if (count === minVotes) {
        toEliminate.push(option);
      }
    }

    if (toEliminate.length > 1 && tieBreaking === "previous_round") {
      toEliminate = breakTieByPreviousRounds(toEliminate, roundLogs);
    }

    if (toEliminate.length === activeOptions.size) {
      roundLog.status = "Unbreakable tie";
      roundLog.eliminated = toEliminate;
      roundLogs.push(roundLog);
      return result(null);
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

  return result(null, { error: `Tally exceeded max rounds (${maxRounds}).` });
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
  validateVote,
  formatBallots,
  tally,
};
