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

/**
 * Decides which of the options tied for last place to eliminate.
 *
 * 1. If the tied options have no votes, eliminate them all at once. No ballots move, so this is
 *    identical to eliminating them one at a time. (Batching options that do hold votes is not safe:
 *    it skips intermediate rounds that a later previous-round tie-break may depend on.)
 * 2. Otherwise, look back through earlier rounds, most recent first, keeping only the options
 *    with the fewest votes in each, until one remains.
 * 3. Otherwise, eliminate whichever remaining option comes first in `tieBreakOrder`.
 *
 * @param {string[]} tied - Options tied for the fewest votes this round.
 * @param {Map<string, number>} roundTally - This round's vote counts for every active option.
 * @param {object[]} previousRounds - Round logs for the rounds already completed.
 * @param {string[]} [tieBreakOrder] - Every option, in the order they lose unresolved ties.
 * @returns {{eliminate: string[], method: string}|{unresolved: string[]}} - The options to eliminate and
 *   the rule that chose them, or the options still tied if no rule separates them.
 */
function resolveTie(tied, roundTally, previousRounds, tieBreakOrder) {
  if (roundTally.get(tied[0]) === 0) {
    return { eliminate: tied, method: "batch" };
  }

  let remaining = tied;
  for (let i = previousRounds.length - 1; i >= 0 && remaining.length > 1; i--) {
    const pastTally = previousRounds[i].tally;
    const fewest = Math.min(...remaining.map((option) => pastTally[option]));
    remaining = remaining.filter((option) => pastTally[option] === fewest);
  }
  if (remaining.length === 1) {
    return { eliminate: remaining, method: "previous_round" };
  }

  if (tieBreakOrder) {
    const loser = tieBreakOrder.find((option) => remaining.includes(option));
    return { eliminate: [loser], method: "tie_break_order" };
  }

  return { unresolved: remaining };
}

/**
 * Runs the full round-by-round RCV simulation.
 *
 * Each round, an option wins by holding a majority of the continuing (non-exhausted) ballots.
 *
 * @param {string[][]} ballots - A *clean* array of ballots, as returned by `formatBallots()`.
 * @param {string[]} options - The official list of all valid options.
 * @param {object} [config] - An object specifying the rules for the election.
 * @param {string[]} [config.tieBreakOrder] - Every option, ordered from first to last to lose a tie that
 *   earlier rounds cannot separate (e.g. the result of drawing lots in advance). Without it, such a tie stops
 *   the tally with status "Unresolved tie".
 * @param {number} [config.maxRounds] - A safety limit to prevent infinite loops. Defaults to `options.length`,
 *   which is always enough since every round either finds a winner or eliminates at least one option.
 * @returns {object} - A detailed, round-by-round results object.
 */
function tally(ballots, options, config = {}) {
  const maxRounds = config.maxRounds ?? options.length;
  const tieBreakOrder = config.tieBreakOrder;
  if (
    tieBreakOrder !== undefined &&
    (!Array.isArray(tieBreakOrder) || !options.every((option) => tieBreakOrder.includes(option)))
  ) {
    throw new Error("config.tieBreakOrder must be an array listing every option.");
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
      tieBreak: null,
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

    if (continuingVotes === 0) {
      roundLog.status = "No continuing ballots";
      roundLogs.push(roundLog);
      return result(null);
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

    if (toEliminate.length > 1) {
      const resolution = resolveTie(toEliminate, roundTally, roundLogs, tieBreakOrder);
      if (resolution.unresolved) {
        roundLog.status = "Unresolved tie";
        roundLogs.push(roundLog);
        return result(null, {
          error: `Tie for last place between ${resolution.unresolved.join(", ")} cannot be broken by earlier rounds. Pass config.tieBreakOrder to resolve it.`,
        });
      }
      toEliminate = resolution.eliminate;
      roundLog.tieBreak = resolution.method;
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
