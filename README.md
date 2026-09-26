# rcv-core-logic

[![NPM Version](https://img.shields.io/npm/v/@destinlmincy/rcv-core-logic)](https://www.npmjs.com/package/@destinlmincy/rcv-core-logic)
[![License](https://img.shields.io/badge/License-Apache%202.0%20%2B%20Commons%20Clause-blue.svg)](https://github.com/DestinMincy/rcv-core-logic/blob/master/LICENSE)
![Completed]( https://img.shields.io/badge/Progress-Complete-green)

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

## API Reference

The library exports four functions.

`validateVote(ballot, candidates)`
Checks if a single ballot is valid. A valid ballot must not contain any duplicate candidates or any candidates that are not on the official list.

**Arguments:**

- `ballot` (Array<string>): A voter's ranked choices, e.g., `['option_A', 'option_C']`.

- `candidates` (Array<string>): The official list of all valid candidates, e.g., `['option_A', 'option_B', 'option_C']`.

**Returns:** (object): An object with a `valid` boolean and an `error` message.

- `{ valid: true, error: null }`

- `{ valid: false, error: 'Reason for failure' }`

**Example:**

```JavaScript

const { validateVote } = require('@destinlmincy/rcv-core-logic');

const candidates = ['A', 'B', 'C'];

// Valid vote
const vote1 = ['A', 'C', 'B'];
console.log(validateVote(vote1, candidates));
// Output: { valid: true, error: null }

// Invalid: Contains a duplicate
const vote2 = ['B', 'A', 'B'];
console.log(validateVote(vote2, candidates));
// Output: { valid: false, error: 'Duplicate found: ballot contains repeated option rankings.' }

// Invalid: Contains an unknown candidate
const vote3 = ['D', 'A'];
console.log(validateVote(vote3, candidates));
// Output: { valid: false, error: 'Invalid choice: "D" is not one of the options.' }

```

`formatBallots(rawVotes, candidates, onInvalid)`
Cleans and formats a "messy" array of vote objects (e.g., from a database) into a "clean" array of arrays for the tally function. It uses validateVote() internally to filter out any invalid ballots.

**Arguments:**

- `rawVotes` (Array<object>): An array of vote objects. Each object must have a rankings property that is an array of strings.

- `candidates` (Array<string>): The official list of all valid candidates.

- `onInvalid` (function, optional): Called as `onInvalid(vote, error)` for each vote that is skipped. The library never writes to the console, so pass this if you want to log or count rejected ballots.

**Returns:** (Array<Array<string>>): A clean array of only the valid ballots.

**Example:**

```JavaScript

const { formatBallots } = require('@destinlmincy/rcv-core-logic');

const candidates = ['A', 'B', 'C'];
const rawVotes = [
  { userId: 'u-123', rankings: ['A', 'B'] },
  { userId: 'u-456', rankings: ['B', 'A', 'B'] }, // Invalid (duplicate)
  { userId: 'u-789', rankings: ['C'] },
  { userId: 'u-101', rankings: ['D'] }             // Invalid (bad candidate)
];

const cleanBallots = formatBallots(rawVotes, candidates, (vote, error) => {
  console.warn(`Skipped ${vote.userId}: ${error}`);
});

console.log(cleanBallots);
// Output: [ ['A', 'B'], ['C'] ]

```

`drawTieBreakOrder(candidates, randomInt)`
Draws a random lot order for breaking ties, using a cryptographically secure random source. Pass the result to `tally()` as `config.tieBreakOrder`.

**Call it once, when the election is created, and store the result with the election.** Every count and recount then uses the same order, so the same ballots always produce the same winner. Do not draw a new order each time you tally.

Without a lot order, a tie that earlier rounds can't break stops the tally with no winner. In small elections that is common: in simulated elections with 3–20 voters, 17–36% hit one. With a stored lot order, none did.

**Arguments:**

- `candidates` (Array<string>): The official list of all valid candidates.

- `randomInt` (function, optional): Returns a uniformly random integer in `[0, n)` when called as `randomInt(n)`. Defaults to a secure source; override it only for testing or a public, reproducible draw.

**Returns:** (Array<string>): A shuffled copy of `candidates`. Earlier entries lose unresolved ties first.

**Example:**

```JavaScript

const { drawTieBreakOrder, tally } = require('@destinlmincy/rcv-core-logic');

// When the election is created:
const candidates = ['A', 'B', 'C'];
const tieBreakOrder = drawTieBreakOrder(candidates); // e.g. ['C', 'A', 'B']
// ...save tieBreakOrder alongside the election...

// When counting, and on every recount:
const results = tally(ballots, candidates, { tieBreakOrder });

```

`tally(ballots, candidates, config)`
The main engine. This function takes a clean list of ballots and runs the full round-by-round RCV simulation.

**Arguments:**

- `ballots` (Array<Array<string>>): A clean array of ballots, as returned by `formatBallots()`.

- `candidates` (Array<string>): The official list of all valid candidates.

- `config` (object, optional): An object specifying the rules for the election.

  - `tieBreakOrder` (Array<string>, optional): Every candidate, ordered from first to last to lose a tie that earlier rounds cannot break, such as the stored result of `drawTieBreakOrder()`. Must list every candidate or `tally()` throws. Strongly recommended.

  - `maxRounds` (number): A safety limit to prevent infinite loops (e.g., `20`). Defaults to the number of candidates.

**Returns:** (object): A detailed, round-by-round results object.

- Ties for last place are resolved in this order, and each round's `tieBreak` field records which rule was used (`null` if there was no tie):
  1. `"batch"`: every tied option has zero votes, so they are all eliminated at once. No ballots move, so this is identical to eliminating them one at a time.
  2. `"previous_round"`: eliminate the tied option with the fewest votes in the most recent earlier round that separates them.
  3. `"tie_break_order"`: eliminate whichever remaining tied option comes first in `config.tieBreakOrder`.

  If none of these applies, the tally stops with `status: "Unresolved tie"`, `winner: null`, and an `error` naming the tied options. Pass a `tieBreakOrder` from `drawTieBreakOrder()` to avoid this. The tally also stops, with `status: "No continuing ballots"`, if every ballot is exhausted.
- Each round, an option wins with a majority of the *continuing* ballots, i.e. those not yet exhausted (`floor(continuing / 2) + 1`). Each round reports its own `threshold` and `exhausted` count; the top-level `threshold` is the first round's.
- `rounds[n].transfers` maps each eliminated option to where its ballots went, e.g. `{ "C": { "B": 1, "exhausted": 2 } }`.

**Example:**

```JavaScript

const { tally } = require('@destinlmincy/rcv-core-logic');

// Note: This would come from formatBallots()
const ballots = [
  ['A', 'B', 'C'],
  ['B', 'A', 'C'],
  ['A', 'C', 'B'],
  ['C', 'B', 'A'],
  ['B', 'A', 'C']
];

const candidates = ['A', 'B', 'C'];
const config = {
  maxRounds: 20
};

const results = tally(ballots, candidates, config);

console.log(JSON.stringify(results, null, 2));

```

**Example `results` Output:**

```JSON

{
  "winner": "B",
  "totalVotes": 5,
  "threshold": 3,
  "options": ["A", "B", "C"],
  "rounds": [
    {
      "round": 1,
      "threshold": 3,
      "exhausted": 0,
      "tally": {
        "A": 2,
        "B": 2,
        "C": 1
      },
      "status": "Elimination",
      "eliminated": ["C"],
      "tieBreak": null,
      "transfers": {
        "C": {
          "B": 1
        }
      }
    },
    {
      "round": 2,
      "threshold": 3,
      "exhausted": 0,
      "tally": {
        "A": 2,
        "B": 3
      },
      "status": "Winner found",
      "eliminated": [],
      "tieBreak": null,
      "transfers": {}
    }
  ]
}

```

---

## Running Tests
```Bash

npm test

```

---

## Copyright
Copyright (c) 2025 Destin L Mincy. All Rights Reserved.
