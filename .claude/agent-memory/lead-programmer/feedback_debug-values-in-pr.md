---
name: debug-values-in-pr
description: Watch for debug/testing values accidentally committed in PRs that change unrelated files
metadata:
  type: feedback
---

During PR review, always check that every changed file aligns with the PR's stated purpose. If a PR claims to be a "layout fix" but also touches gameplay data (gold amounts, skill grants, stat defaults), flag it as a blocking issue.

**Why:** PR #32 ("fix: screen flex-direction and loadout panel layout") accidentally included debug values (`permanentGold: 5000`, pre-granted `thunder_strike`) in `meta-progression.js`. These were unrelated to the layout fix and appeared to be testing leftovers.

**How to apply:** For every PR, cross-check the diff against the PR title and description. If any file contains changes outside the stated scope, flag them as architectural violations and require either reversion or moving to a separate PR with proper justification.
