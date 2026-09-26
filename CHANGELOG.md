# Changelog

## 2.0.0

### Breaking changes
- **`config.tieBreaking` is removed.** Eliminating every option tied for last place (`eliminate_all`) could knock out an option that would have won once the others' votes transferred. Ties are now resolved, in order, by:
  1. eliminating tied options together only when they all have zero votes (no ballots move, so the outcome can't change);
  2. the most recent earlier round that separates them;
  3. `config.tieBreakOrder`, a lot order you supply.

  If none applies, the tally stops with `status: "Unresolved tie"`, `winner: null`, and an `error` naming the tied options. It never guesses.
- **The winning threshold is a majority of continuing (non-exhausted) ballots, recomputed each round**, instead of a fixed majority of all ballots. The top-level `threshold` is the first round's.
- `"Unbreakable tie"` is now `"Unresolved tie"`. New status: `"No continuing ballots"`.
- Each round log has new fields: `threshold`, `exhausted` and `tieBreak`.
- `formatBallots()` no longer writes to the console. Pass the new `onInvalid(vote, error)` callback to see skipped votes.

### Added
- `drawTieBreakOrder(options)`: draws a cryptographically secure random lot order for `tieBreakOrder`. Draw it once when an election is created and store it, so recounts always give the same result. Without one, small elections often stop on an unresolved tie.
- `config` is optional; `maxRounds` defaults to the number of options.

### Fixed
- The last option standing was "eliminated" as a tie with itself when exhausted ballots kept it under the threshold, returning no winner.
- `tally()` threw without a `config`, and ran zero rounds without `maxRounds`.
- `npm test` exited successfully when tests failed.
- README examples, error strings, result keys and links now match the code.
- The `package.json` license field now points to the LICENSE file instead of claiming plain Apache-2.0.

### Upgrading from 1.x
- Remove `tieBreaking` from your config.
- Call `drawTieBreakOrder(candidates)` when each election is created, store the result, and pass it as `config.tieBreakOrder` on every tally.
- Handle `status: "Unresolved tie"` and `"No continuing ballots"` wherever you check for `"Unbreakable tie"`.
