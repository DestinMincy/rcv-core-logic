# rcv-core-logic

[![NPM Version](https://img.shields.io/npm/v/rcv-core-logic)](https://www.npmjs.com/package/@destinlmincy/rcv-core-logic)
[![License](https://img.shields.io/badge/License-Apache%202.0%20%2B%20Commons%20Clause-blue.svg)](https://github.com/DeatinMincy/rcv-core-logic/blob/main/LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/DestinMincy/rcv-core-logic/node.js.yml?branch=main)](https://github.com/DestinMincy/rcv-core-logic/actions)

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

## API Reference

The library exports three main functions.

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

const { validateVote } = require('rcv-core-logic');

const candidates = ['A', 'B', 'C'];

// Valid vote
const vote1 = ['A', 'C', 'B'];
console.log(validateVote(vote1, candidates));
// Output: { valid: true, error: null }

// Invalid: Contains a duplicate
const vote2 = ['B', 'A', 'B'];
console.log(validateVote(vote2, candidates));
// Output: { valid: false, error: 'Duplicate candidates: A ballot cannot rank the same candidate more than once.' }

// Invalid: Contains an unknown candidate
const vote3 = ['D', 'A'];
console.log(validateVote(vote3, candidates));
// Output: { valid: false, error: 'Invalid candidate: "D" is not one of the options.' }

```

`formatBallots(rawVotes, candidates)`
Cleans and formats a "messy" array of vote objects (e.g., from a database) into a "clean" array of arrays for the tally function. It uses validateVote() internally to filter out any invalid ballots.

**Arguments:**

- `rawVotes` (Array<object>): An array of vote objects. Each object must have a rankings property that is an array of strings.

- `candidates` (Array<string>): The official list of all valid candidates.

**Returns:** (Array<Array<string>>): A clean array of only the valid ballots.

**Example:**

```JavaScript

const { formatBallots } = require('rcv-core-logic');

const candidates = ['A', 'B', 'C'];
const rawVotes = [
  { userId: 'u-123', rankings: ['A', 'B'] },
  { userId: 'u-456', rankings: ['B', 'A', 'B'] }, // Invalid (duplicate)
  { userId: 'u-789', rankings: ['C'] },
  { userId: 'u-101', rankings: ['D'] }             // Invalid (bad candidate)
];

const cleanBallots = formatBallots(rawVotes, candidates);

console.log(cleanBallots);
// Output: [ ['A', 'B'], ['C'] ]

```

`tally(ballots, candidates, config)`
The main engine. This function takes a clean list of ballots and runs the full round-by-round RCV simulation.

**Arguments:**

- `ballots` (Array<Array<string>>): A clean array of ballots, as returned by `formatBallots()`.

- `candidates` (Array<string>): The official list of all valid candidates.

- `config` (object): An object specifying the rules for the election.

  - `tieBreaking` (string): How to handle ties for elimination. (e.g., `'eliminate_all'`).

  - `maxRounds` (number): A safety limit to prevent infinite loops (e.g., `20`).

**Returns:** (object): A detailed, round-by-round results object.

**Example:**

```JavaScript

const { tally } = require('rcv-core-logic');

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
  tieBreaking: 'eliminate_all',
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
  "candidates": ["A", "B", "C"],
  "rounds": [
    {
      "round": 1,
      "tally": {
        "A": 2,
        "B": 2,
        "C": 1
      },
      "status": "Elimination",
      "eliminated": ["C"],
      "transfers": {
        "C": {
          "target": "B",
          "count": 1
        }
      }
    },
    {
      "round": 2,
      "tally": {
        "A": 2,
        "B": 3
      },
      "status": "Winner found",
      "eliminated": [],
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

## Copyright
Copyright (c) 2025 Destin L. Mincy. All Rights Reserved.