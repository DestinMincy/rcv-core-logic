const fs = require('fs');

// --- Configuration ---
const NUM_BALLOTS = 1000;
const NUM_CANDIDATES = 5;

// --- Helper Functions ---

/**
 * Generates a random name.
 * @returns {string} A random name.
 */
function generateRandomName() {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy'];
  const lastNames = ['Smith', 'Jones', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson'];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

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
 * @param {string[]} candidates The list of candidates.
 * @returns {object} A ballot object with rankings and approvals.
 */
function generateRandomBallot(candidates) {
  const rankings = shuffle([...candidates]).slice(0, Math.floor(Math.random() * candidates.length) + 1);
  const approvals = [];
  for (const candidate of candidates) {
    if (Math.random() > 0.5) {
      approvals.push(candidate);
    }
  }
  return { rankings, approvals };
}

// --- Main ---

const candidates = [];
for (let i = 0; i < NUM_CANDIDATES; i++) {
  candidates.push(generateRandomName());
}

const ballots = [];
for (let i = 0; i < NUM_BALLOTS; i++) {
  ballots.push(generateRandomBallot(candidates));
}

fs.writeFileSync('ballots.json', JSON.stringify(ballots, null, 2));

console.log(`Successfully generated ${NUM_BALLOTS} ballots with ${NUM_CANDIDATES} candidates and saved to ballots.json`);
