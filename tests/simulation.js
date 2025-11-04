/**
 * @file simulation.js
 * @description Simulates a large-scale Ranked Choice Voting election with randomized ballots.
 */

const { tally } = require('../index.js');
const fs = require('fs');

// --- Simulation Configuration ---
const NUM_VOTERS = 1000000; // 1,000,000 voters
const CANDIDATES = ['Democratic', 'Republican', 'Independent', 'Libertarian', 'Green', 'Constitution', 'Working Families'];
const CONFIG = {
  tieBreaking: 'approval',
  maxRounds: 20,
};

// --- Helper Functions ---

/**
 * Generates a ranked ballot based on a weighted lottery system.
 * @param {object} profileWeights - An object where keys are candidate names and values are their weights.
 * @returns {string[]} A ranked list of candidates.
 */
function generateWeightedRankings(profileWeights) {
  let pool = [];
  for (const candidate in profileWeights) {
    for (let i = 0; i < profileWeights[candidate]; i++) {
      pool.push(candidate);
    }
  }

  const rankings = [];
  while (rankings.length < CANDIDATES.length) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const winner = pool[randomIndex];
    rankings.push(winner);
    pool = pool.filter(c => c !== winner);
  }
  return rankings;
}

/**
 * Generates a single random ballot based on voter profiles.
 * @returns {object} A ballot object with rankings and approvals.
 */
function generateRandomBallot() {
  const weights = {
    Democratic:       { Democratic: 10, 'Working Families': 9, Green: 8, Independent: 6, Libertarian: 4, Republican: 3, Constitution: 2 },
    Republican:       { Republican: 10, Constitution: 9, Libertarian: 8, Independent: 6, Democratic: 3, 'Working Families': 2, Green: 2 },
    Independent:      { Independent: 10, Democratic: 7, Republican: 7, Libertarian: 5, Green: 5, 'Working Families': 4, Constitution: 4 },
    Libertarian:      { Libertarian: 10, Republican: 8, Constitution: 7, Independent: 6, Democratic: 4, Green: 3, 'Working Families': 2 },
    Green:            { Green: 10, 'Working Families': 9, Democratic: 8, Independent: 6, Libertarian: 3, Republican: 2, Constitution: 1 },
    Constitution:     { Constitution: 10, Republican: 9, Libertarian: 8, Independent: 6, Democratic: 2, 'Working Families': 1, Green: 1 },
    'Working Families': { 'Working Families': 10, Green: 9, Democratic: 8, Independent: 6, Libertarian: 2, Republican: 1, Constitution: 1 },
  };

  const rand = Math.random();
  let profileWeights;

  if (rand < 0.25) { // 25% Democratic
    profileWeights = weights.Democratic;
  } else if (rand < 0.47) { // 22% Republican
    profileWeights = weights.Republican;
  } else if (rand < 0.67) { // 20% Independent
    profileWeights = weights.Independent;
  } else if (rand < 0.79) { // 12% Libertarian
    profileWeights = weights.Libertarian;
  } else if (rand < 0.89) { // 10% Green
    profileWeights = weights.Green;
  } else if (rand < 0.95) { // 6% Working Families
    profileWeights = weights['Working Families'];
  } else { // 5% Constitution
    profileWeights = weights.Constitution;
  }

  const rankings = generateWeightedRankings(profileWeights);
  const approvals = [];
  const approvalProbabilities = [0.95, 0.80, 0.65, 0.50, 0.35, 0.20, 0.05];

  rankings.forEach((candidate, index) => {
    if (Math.random() < approvalProbabilities[index]) {
      approvals.push(candidate);
    }
  });

  return { rankings, approvals };
}

// --- Main Simulation ---

let output = '--- Starting Large-Scale RCV Simulation ---\n';
output += `Simulating an election with ${NUM_VOTERS.toLocaleString()} voters and ${CANDIDATES.length} candidates.\n`;
output += 'Ballot distribution is weighted to mimic real-world voting patterns.\n';

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
