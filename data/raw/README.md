# Sample match fixtures

These two files are version-controlled test fixtures (see `.gitignore`
exceptions), not real season data.

## match_001
Clean, simulated match used for testing possession reconstruction.
Events are designed to produce known, predictable possession outcomes
for assertions in `tests/test_possessions.py`.

## match_002
Stress test for the validation layer. Deliberately includes edge
cases:
- Sub-1-second gaps between different event codes (tests the minimum
  event-gap rule without being an actual tagging error)
- Event codes not present in match_001 (COUP_FRANC, TOUCHE,
  DEGAGEMENT), used to confirm the allowed event code vocabulary is
  current
- Normal stoppage-time behavior: some half 1 events tagged past the
  45-minute mark, and half 2 starting near the 45-minute mark rather
  than resetting to 0 — both expected, not errors
