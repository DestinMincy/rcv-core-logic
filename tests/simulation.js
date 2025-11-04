/**
 * @file simulation.js
 * @description Simulates a large-scale Ranked Choice Voting election with randomized ballots.
 */

const { tally } = require('../index.js');
const fs = require('fs');

// --- Simulation Configuration ---
const NUM_VOTERS = 50000; // 50,000 voters
const CANDIDATES = ['Candidate A', 'Candidate B', 'Candidate C', 'Candidate D', 'Candidate E'];
const CONFIG = {
  tieBreaking: 'approval',
  maxRounds: 20,
};

// --- Helper Functions ---

/**
 * Shuffles an array in place.
 * @param {Array} array The array to shuffle.
 * @returns {Array} The shuffled array.
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Generates a single random ballot.
 * @returns {object} A ballot object with rankings and approvals.
 */
function generateRandomBallot() {
  const rankings = shuffle([...CANDIDATES]).slice(0, Math.floor(Math.random() * CANDIDATES.length) + 1);
  const approvals = [];
  for (const candidate of CANDIDATES) {
    if (Math.random() > 0.5) {
      approvals.push(candidate);
    }
  }
  return { rankings, approvals };
}

// --- Main Simulation ---

let output = '--- Starting Large-Scale RCV Simulation ---\n';
output += `Simulating an election with ${NUM_VOTERS.toLocaleString()} voters and ${CANDIDATES.length} candidates.\n`;

const ballots = [];
for (let i = 0; i < NUM_VOTERS; i++) {
  ballots.push(generateRandomBallot());
}

output += 'Ballot generation complete. Running tally...\n';

const results = tally(ballots, CANDIDATES, CONFIG);

output += '--- Simulation Results ---\n';

if (results.winner) {
  output += `Winner: ${results.winner}\n`;
} else {
  output += 'No winner was found.\n';
}

output += `Total Votes: ${results.totalVotes.toLocaleString()}\n`;
output += `Threshold: ${results.threshold.toLocaleString()}\n`;
output += '\n--- Round-by-Round Breakdown ---\n';

results.rounds.forEach(round => {
  output += `\nRound ${round.round}: ${round.status}\n`;
  output += 'Tally:\n';
  for (const [option, count] of Object.entries(round.tally)) {
    const percentage = (count / results.totalVotes) * 100;
    output += `  - ${option}: ${count.toLocaleString()} votes (${percentage.toFixed(2)}%)\n`;
  }

  if (Object.keys(round.approvalPercentages).length > 0) {
    output += 'Approval Percentages (pre-calculated):\n';
    for (const [option, percentage] of Object.entries(round.approvalPercentages)) {
      output += `  - ${option}: ${percentage.toFixed(2)}%\n`;
    }
  }

  if (round.eliminated.length > 0) {
    output += `Eliminated: ${round.eliminated.join(', ')}\n`;
  }

  if (Object.keys(round.transfers).length > 0) {
    output += 'Transfers:\n';
    for (const [from, to] of Object.entries(round.transfers)) {
      for (const [dest, count] of Object.entries(to)) {
        output += `  - ${count.toLocaleString()} votes from ${from} to ${dest}\n`;
      }
    }
  }
});

if (results.error) {
  output += `\nError: ${results.error}\n`;
}

fs.writeFileSync('D:/Github Repos/rcv-core-logic/tests/sim.log', output);

console.log('Simulation complete. Results written to sim.log');
