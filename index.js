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
  if (!ballot || typeof ballot !== 'object' || ballot === null) {
    return { valid: false, error: 'Ballot is not a valid object.' };
  }

  const { rankings, approvals } = ballot;

  if (!rankings || !Array.isArray(rankings)) {
    return { valid: false, error: 'Ballot rankings are null or not an array.' };
  }
  if (!options || !Array.isArray(options)) {
    return { valid: false, error: 'Options list is null or not an array.' };
  }

  const optionSet = new Set(options);

  // Validate rankings
  for (const choice of rankings) {
    if (typeof choice !== 'string') {
      return {
        valid: false,
        error: 'Invalid choice: rankings contain a non-string value.',
      };
    }
    if (!optionSet.has(choice)) {
      return {
        valid: false,
        error: `Invalid choice: "${choice}" is not one of the options.`,
      };
    }
  }

  const rankingSet = new Set(rankings);
  if (rankingSet.size !== rankings.length) {
    return {
      valid: false,
      error: 'Duplicate found: rankings contain repeated options.',
    };
  }

  // Validate approvals, if they exist
  if (approvals) {
    if (!Array.isArray(approvals)) {
      return {
        valid: false,
        error: 'Approvals must be an array.',
      };
    }
    for (const approved of approvals) {
      if (typeof approved !== 'string') {
        return {
          valid: false,
          error: 'Invalid choice: approvals contain a non-string value.',
        };
      }
      if (!optionSet.has(approved)) {
        return {
          valid: false,
          error: `Invalid approved choice: "${approved}" is not one of the options.`,
        };
      }
    }
    const approvalSet = new Set(approvals);
    if (approvalSet.size !== approvals.length) {
      return {
        valid: false,
        error: 'Duplicate found: approvals contain repeated options.',
      };
    }
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
    if (!vote || typeof vote !== "object" || !vote.rankings) {
      continue;
    }

    const validation = validateVote(vote, options);

    if (validation.valid) {
      cleanBallots.push({ rankings: vote.rankings, approvals: vote.approvals || [] });
    } else {
      console.warn(`Invalid ballot skipped: ${validation.error}`);
    }
  }

  return cleanBallots;
}

/**
 * Calculates approval ratings for all candidates.
 * @param {object[]} ballots - A clean array of ballots.
 * @param {string[]} options - The official list of all valid options.
 * @returns {object} An object containing raw approval counts and approval percentages.
 */
function calculateApproval(ballots, options) {
  const totalVotes = ballots.length;
  const approvalCounts = new Map();
  const approvalPercentages = new Map();

  options.forEach(option => approvalCounts.set(option, 0));

  ballots.forEach(ballot => {
    if (ballot.approvals) {
      ballot.approvals.forEach(approvedOption => {
        if (approvalCounts.has(approvedOption)) {
          approvalCounts.set(approvedOption, approvalCounts.get(approvedOption) + 1);
        }
      });
    }
  });

  options.forEach(option => {
    const count = approvalCounts.get(option);
    approvalPercentages.set(option, (count / totalVotes) * 100);
  });

  return { counts: approvalCounts, percentages: approvalPercentages };
}

/**
 * Runs the full round-by-round RCV simulation.
 *
 * @param {object[]} ballots - A *clean* array of ballots, as returned by `formatBallots()`.
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

  const { counts: initialApprovalCounts, percentages: initialApprovalPercentages } = calculateApproval(ballots, options);

  let activeOptions = new Set(options);
  let currentBallotChoices = ballots.map((ballot) =>
    getActiveChoice(ballot.rankings, activeOptions)
  );

  for (let round = 1; round <= config.maxRounds; round++) {
    const roundTally = new Map();
    const roundLog = {
      round: round,
      tally: {},
      status: "",
      eliminated: [],
      transfers: {},
      approvalRatings: {},
      approvalPercentages: {},
    };

    initialApprovalCounts.forEach((count, option) => {
      roundLog.approvalRatings[option] = count;
    });
    initialApprovalPercentages.forEach((percentage, option) => {
      roundLog.approvalPercentages[option] = percentage;
    });

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

    let toEliminate = [];
    for (const [option, count] of roundTally.entries()) {
      if (count === minVotes) {
        toEliminate.push(option);
      }
    }

    if (toEliminate.length > 1 && config.tieBreaking === 'approval') {
      let minApprovalPercentage = Infinity;
      toEliminate.forEach(option => {
        const percentage = initialApprovalPercentages.get(option);
        if (percentage < minApprovalPercentage) {
          minApprovalPercentage = percentage;
        }
      });

      const newToEliminate = [];
      toEliminate.forEach(option => {
        if (initialApprovalPercentages.get(option) === minApprovalPercentage) {
          newToEliminate.push(option);
        }
      });

      if (newToEliminate.length > 0 && newToEliminate.length < toEliminate.length) {
        toEliminate = newToEliminate;
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
      const originalBallot = ballots[i].rankings;
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
  calculateApproval,
};
