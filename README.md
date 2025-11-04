# rcv-core-logic

[![NPM Version](https://img.shields.io/npm/v/@destinlmincy/rcv-core-logic)](https://www.npmjs.com/package/@destinlmincy/rcv-core-logic)
[![License](https://img.shields.io/badge/License-Apache%202.0%20%2B%20Commons%20Clause-blue.svg)](https://github.com/DeatinMincy/rcv-core-logic/blob/main/LICENSE)
![Completed](https://img.shields.io/badge/Progress-Complete-green)

A pure, lightweight, and dependency-free JavaScript library for calculating Ranked Choice Voting (RCV) elections.

---

## ⚠️ License & Commercial Use

This is a proprietary, **source-available** library.

It is licensed under **Apache 2.0 with The Commons Clause** (v1.0). This means you are free to view, fork, and refer to this code for **personal, non-commercial, and evaluation purposes only.**

You **may not** use this code, in whole or in part, for any commercial purpose, include it in a commercial product, or offer it as a paid service without the express written permission of the copyright holder.

- See the `LICENSE` file for the full Apache 2.0 terms.
- See the `COMMONS_CLAUSE` file for the commercial restrictions.

---

## Core Philosophy

This library is designed to be the "mathematical engine" for a larger voting application. It follows a pure, functional approach:

- **Pure:** Contains zero external dependencies.
- **Testable:** Can be fully unit-tested without needing a database or network connection.
- **Reusable:** This logic can be imported by any application without tying it to a specific framework. It just takes in data and returns data.

---

## Installation

```bash
npm install @destinlmincy/rcv-core-logic
```

---

## Usage

Here's a complete example of how to use the library, from a raw list of votes to a final result:

```javascript
const { validateVote, formatBallots, tally } = require('@destinlmincy/rcv-core-logic');

// 1. Define your candidates
const candidates = ['A', 'B', 'C'];

// 2. Get your raw votes (e.g., from a database)
const rawVotes = [
  { userId: 'u-123', rankings: ['A', 'B'], approvals: ['A'] },
  { userId: 'u-456', rankings: ['B', 'A', 'B'] }, // Invalid (duplicate)
  { userId: 'u-789', rankings: ['C'] },
  { userId: 'u-101', rankings: ['D'] }             // Invalid (bad candidate)
];

// 3. Format and validate the ballots
const cleanBallots = formatBallots(rawVotes, candidates);
// cleanBallots is now: [ { rankings: ['A', 'B'], approvals: ['A'] }, { rankings: ['C'], approvals: [] } ]

// 4. Define your election configuration
const config = {
  tieBreaking: 'approval',
  maxRounds: 20
};

// 5. Tally the votes
const results = tally(cleanBallots, candidates, config);

// 6. Print the results
console.log(JSON.stringify(results, null, 2));
```

---

## API Reference

The library exports four main functions: `validateVote`, `formatBallots`, `tally`, and `calculateApproval`.

### `validateVote(ballot, candidates)`

Checks if a single ballot is valid. A valid ballot must not contain any duplicate candidates or any candidates that are not on the official list.

**Arguments:**

- `ballot` ( object ): A voter's ballot, containing rankings and approvals.
- `rankings` ( Array< string > ): A voter's ranked choices, e.g., `['option_A', 'option_C']`.
- `approvals` ( Array< string > ): A voter's approved choices, e.g., `['option_A', 'option_B']`.
- `candidates` ( Array< string > ): The official list of all valid candidates, e.g., `['option_A', 'option_B', 'option_C']`.

**Returns:** ( object ): An object with a `valid` boolean and an `error` message.

- `{ valid: true, error: null }`
- `{ valid: false, error: 'Reason for failure' }`

### `formatBallots(rawVotes, candidates)`

Cleans and formats a "messy" array of vote objects (e.g., from a database) into a "clean" array of objects for the tally function. It uses `validateVote()` internally to filter out any invalid ballots.

**Arguments:**

- `rawVotes` ( Array< object > ): An array of vote objects. Each object must have a `rankings` property that is an array of strings and may have an `approvals` property.
- `candidates` ( Array< string > ): The official list of all valid candidates.

**Returns:** ( Array< object > ): A clean array of only the valid ballots.

### `calculateApproval(ballots, options)`

Calculates approval ratings for all candidates.

**Arguments:**

- `ballots` ( object[] ): A clean array of ballots.
- `options` ( string[] ): The official list of all valid options.

**Returns:** ( object ): An object containing raw approval counts and approval percentages.

### `tally(ballots, candidates, config)`

The main engine. This function takes a clean list of ballots and runs the full round-by-round RCV simulation.

**Arguments:**

- `ballots` ( Array< object > ): A clean array of ballots, as returned by `formatBallots()`.
- `candidates` ( Array< string > ): The official list of all valid candidates.
- `config` ( object ): An object specifying the rules for the election.
- `tieBreaking` ( string ): How to handle ties for elimination. (e.g., `'eliminate_all'`, `'approval'`).
- `maxRounds` ( number ): A safety limit to prevent infinite loops (e.g., `20`).

**Returns:** ( object ): A detailed, round-by-round results object. See the example in the "Usage" section for the structure of the results object.

---

## Development

### Running Tests

To run the test suite:

```bash
npm test
```

**Expected Output:**

```
> @destinlmincy/rcv-core-logic@1.0.3 test
> node tests/test.js


Running tests for validateVote()...
  ✔ PASS: should return valid for a correct ballot
  ✔ PASS: should return invalid for a duplicate candidate in rankings
  ✔ PASS: should return invalid for a duplicate candidate in approvals
  ✔ PASS: should return invalid for an unknown candidate in rankings
  ✔ PASS: should return invalid for an unknown candidate in approvals
  ✔ PASS: should return valid for a partial ballot
  ✔ PASS: should return invalid for a ballot containing a non-string choice in rankings
  ✔ PASS: should return invalid for a ballot containing a non-string choice in approvals

Running tests for formatBallots()...
Invalid ballot skipped: Duplicate found: rankings contain repeated options.
Invalid ballot skipped: Invalid choice: "D" is not one of the options.
  ✔ PASS: should filter out invalid and malformed ballots
  ✔ PASS: should return an empty array for empty input

Running tests for tally()...
  ✔ PASS: should find a winner in a single round (clear majority)
  ✔ PASS: should find a winner in multiple rounds (elimination)
  ✔ PASS: should handle an unbreakable tie
  ✔ PASS: should handle exhausted ballots correctly
  ✔ PASS: should use approval votes to break a tie
  ✔ PASS: should use approval votes to break a tie and find a winner

---------------------------------
         Test Summary
---------------------------------
  Total Tests: 16
  Passed:      16

  All tests passed! ✨
---------------------------------
```

### Running Simulations

To run the large-scale simulation:

```bash
npm run simulate
```

The results of the simulation will be written to `tests/sim.log`.

**Example `sim.log` Output:**

```
--- Starting Large-Scale RCV Simulation ---
Simulating an election with 50,000 voters and 5 candidates.
Ballot generation complete. Running tally...
--- Simulation Results ---
Winner: Candidate C
Total Votes: 50,000
Threshold: 25,001

--- Round-by-Round Breakdown ---

Round 1: Elimination
Tally:
  - Candidate A: 9,989 votes (19.98%)
  - Candidate B: 10,019 votes (20.04%)
  - Candidate C: 10,059 votes (20.12%)
  - Candidate D: 9,990 votes (19.98%)
  - Candidate E: 9,943 votes (19.89%)
Approval Percentages (pre-calculated):
  - Candidate A: 49.95%
  - Candidate B: 50.09%
  - Candidate C: 50.30%
  - Candidate D: 50.05%
  - Candidate E: 49.62%
Eliminated: Candidate E
Transfers:
  - 1,991 votes from Candidate E to Candidate A
  - 1,949 votes from Candidate E to exhausted
  - 1,971 votes from Candidate E to Candidate C
  - 2,009 votes from Candidate E to Candidate B
  - 2,023 votes from Candidate E to Candidate D

...

Round 5: Winner found
Tally:
  - Candidate C: 30,009 votes (60.02%)
Approval Percentages (pre-calculated):
  - Candidate A: 49.95%
  - Candidate B: 50.09%
  - Candidate C: 50.30%
  - Candidate D: 50.05%
  - Candidate E: 49.62%
```

---

## Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue on GitHub.

---

## Copyright

Copyright (c) 2025 Destin L. Mincy. All Rights Reserved.
