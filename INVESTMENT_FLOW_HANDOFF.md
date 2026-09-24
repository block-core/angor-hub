# Investment flow handoff — 24 September 2026

This supersedes the 22 September handoff. The user requested comprehensive testing and PR updates, including the compact, vertically centered payment confirmation design. Publishing PR branches is authorized; merging and deployment are not part of this task.

## Active review checkouts

- Hub PR #43: https://github.com/block-core/angor-hub/pull/43
  - Worktree: `/home/yaya/Projects/angor-hub-testnet`
  - Local branch: `blazer-app-improvements`; the existing PR uses remote `further-ux-polish` and is updated by a fast-forward push.
- Companion web-payment PR #976: https://github.com/block-core/angor/pull/976
  - Worktree: `/home/yaya/Projects/angor-web-payment-pr`
  - Branch: `web-payment-polish`, based on main at `0bffa710`.
  - Contains the web payment commits and their shared dependencies, excluding the unrelated desktop UI work on the old branch.

The original `/home/yaya/Projects/angor-hub` checkout has unrelated uncommitted edits. `/home/yaya/Projects/angor-blazor` remains on the earlier investment branch with the confirmation edits preserved. Do not overwrite either checkout or assume it is the PR candidate.

## Implemented and reviewed

- Hub hands the project, active indexer, network and theme directly to Blazor; old investment URLs redirect to the same payment form.
- Same-network indexer failover, relay pagination, validation retries and loading placeholders preserve confirmed data. Discovery errors are separate from project-stat errors so a project failure cannot block Explore pagination.
- Payment forms retain offered funding patterns, fixed subscription prices and all four amount presets in one row. Payments at or above 0.01 BTC offer the desktop app before wallet creation.
- Existing wallets are preserved across mismatched network links. Background health checks cannot overwrite newer settings.
- Browser wallet preparation uses asynchronous Web Crypto BIP-39 derivation and the existing signing-key cache. Copy feedback is inline, with retry on failure.
- Invest, Fund and Subscribe completion uses a 560px maximum-width themed card, centered in the space between navigation and footer. Transaction, recovery phrase and guarded wallet deletion actions remain available.
- The stale Hub application test harness and signal-effect assertions are repaired. Existing lint errors were removed without disabling rules.

## Validation

- Hub production build and all **32 tests pass**, including Node 22.23.2 (CI version family).
- Hub lint: **zero errors**, 78 existing warnings.
- Blazor Debug build and Release publish pass using .NET 8.0.310.
- Full shared suite: **166 passed**, no skips. Full SDK suite on .NET 10.0.111: **349 passed, 14 existing skips**.
- Chromium 153, Firefox 155 and WebKit 26.6 on Linux: desktop 1440×900 and phone 390×844. Published completion, funding/subscription plans, payment thresholds/keyboard focus/backup, Hub production pages and discovery retry/dismiss checks pass. Both themes and additional payment widths from 360 to 2048px were checked where relevant.
- A fresh **real Angornet Fund payment** passed on the Release artifact: backup → invoice → faucet funding → investment broadcast → independent indexer verification → reload → original recovery phrase access.
  - Investment transaction: `b57b2d9424c75760794286b71f0f3841db865185a5550bb666e518b225bf8a8c`.
- Live Hub-to-testnet invoice, BIP-39 vector, copied tick/no toast and preserving an existing wallet on a mismatched network link also passed.

Remaining limits: live Lightning needs configured payer credentials; Invest completion needs founder approval; Subscribe is covered by UI/shared protocol tests, not a live payment. Desktop recovery/import and real-device Safari were not exercised. Existing .NET warnings and the existing HtmlSanitizer NU1902 advisory remain. See PR #976 for the final isolated wallet responsiveness measurement and CI status; do not call the entire system perfect or every payment path end-to-end verified.

## Running locally

From the Hub review worktree:

```sh
ANGOR_BLAZOR_PROJECT=/home/yaya/Projects/angor-web-payment-pr/src/webapp/Angor.Client/Angor.Client.csproj npm start
```

Hub: `http://localhost:4200`; payment app: `http://localhost:5062`. Inspect existing processes before starting duplicates. The launcher enables optimized WASM execution; `ANGOR_BLAZOR_DEBUG=1` opts into slower managed debugging.

Use the global browser-check skill. Scenarios live under `~/.local/share/browser-check/projects/angor-web-payment/` and `angor-hub/`; final reports use `/tmp/angor-pr-*`. Run production checks against a separately served published artifact: publishing into a watched project can restart the dev server and invalidate concurrent browser tests. Timing checks must run separately from other browser/build workloads.

Some local traces and files contain disposable recovery phrases or wallet state. **Do not commit or upload them.** Only public transaction identifiers and summarized results belong in PRs. No mainnet funds were used.
