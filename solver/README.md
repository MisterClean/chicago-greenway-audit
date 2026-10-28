# Historical straight-ahead solver

This Rust crate implements the project's earlier successor-state distance and threshold model. It is retained with its tests, fixtures and publication contracts for reference. The active greenway map follows the designated route through permitted turns using the JavaScript [route pipeline](../docs/methodology.md); it does not consume this solver's scores.

See the [historical technical specification](../docs/technical-spec.md), [solver data contract](../docs/data-contract.md) and [development command guide](../docs/development.md). `npm run verify` checks the active application without requiring Cargo. `npm run verify:legacy` retains the earlier test sequence, including this crate.
