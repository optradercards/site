# Build specs

Work queued for after the Trading Card Summit prep session on 2026-05-16/17.
Each spec is small and self-contained — pick one up cold and ship it.

| # | Spec | Status | Event-day relevance |
|---|---|---|---|
| 01 | [Admin events CRUD + vendor mapping](./01-admin-events-crud.md) | not started | nice-to-have (trader self-service covers RSVPs) |
| 02 | [Buyer magic-link + email receipts](./02-buyer-magic-link-and-receipts.md) | not started | **yes** — buyers walk away with no proof of purchase otherwise |
| 03 | [Listing quantity decrement DB trigger](./03-listing-qty-trigger.md) | not started | **yes** — current app-side decrement is race-prone |
| 04 | [Stuck job sweeper](./04-stuck-job-sweeper.md) | not started | operational hygiene |
| 05 | [PayID provider integration](./05-payid-provider-integration.md) | post-event | deferred — provider onboarding takes weeks |
| 06 | [Inventory reconciliation surface](./06-inventory-reconciliation.md) | exploratory | **yes** if stock drift between Shiny and OP Trader is biting |

See related memory: `[[project-trading-card-summit]]`, `[[project-event-build-decisions]]`.
