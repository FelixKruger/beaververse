# Hosting Beaververse with bounded AI

Planning only · Sources refreshed 17 November 2026 · No service created or deployment authorized.

## Recommended first public pilot

Keep GitHub for source and collaboration. Run the existing Node server and built frontend together on one small always-on service, so a single HTTPS URL handles the world and its WebSocket room. Start with a small invited group; verify the actual internet experience before opening anonymous access broadly.

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) hosts static files. It can keep hosting a solo preview or a frontend that connects elsewhere; it cannot run this Node room server or an always-on AI worker.

The lowest-change option is **Render**. Its current published entry paid service is **$7/month for 512 MB**, with Hobby's 5 GB included bandwidth and then $0.15/GB. This is compute pricing, not an all-in quote or capacity proof. Taxes, storage, AI, voice relay and traffic may add cost. Free services sleep after idle periods and have ephemeral files; Render advises against using them for production. [Pricing](https://render.com/pricing.md) · [Free-service limits](https://render.com/docs/free)

The alternative is **Cloudflare Workers plus a Durable Object per room**. This can offer a useful free allowance and a path to room isolation, but requires porting the current Node transport/lifecycle. Continuous simulation timers undermine hibernation savings. This is a separate engineering choice, not a configuration switch. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

Voice needs a relay fallback before promising reliable cross-network access. Cloudflare currently lists a combined SFU/TURN allowance of 1,000 GB/month, then $0.05/GB egress. Access still needs an account, secure short-lived credentials and abuse limits. [Realtime pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/)

## AI without an unlimited bill

**World simulation should not consume model calls.** Run ordinary movement, collision, permissions and timers as code. A few NPCs can wander with scripted schedules; honest authored responses are preferable to pretending an unavailable model is answering.

For a hosted low-cost guide or triage experiment, **Cloudflare Workers AI** currently provides 10,000 Neurons/day on its free plan. This is compute quota, not a fixed number of messages. Free-plan exhaustion stops requests; some models require a paid billing method. Paid usage can exceed the free allowance. Test a specific model and prompt size before quoting visitors or messages. [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

For local experiments, a self-hosted model service is an option, but this repository does not bundle one or establish its inference quality, latency, spare GPU capacity or availability. Do not expose a raw local inference service to the internet. A local model avoids per-token provider billing but still uses hardware, electricity and operator availability.

Choose a stronger hosted designer/critic only after a small comparison on Beaververse tasks and an approved spend cap. Model/provider names should be configuration, not assumptions embedded in world logic. Never silently fall back from a free quota to a paid account.

Proposed pilot controls: one guide request at a time per visitor, short input/output limits, a global daily quota, bounded retry and timeout, cached approved knowledge, and a clear unavailable state. Designer work runs in batches on selected evidence rather than continuously on every utterance. Reserve budget before each call; reconcile actual usage afterward. Provider billing alerts are not universal hard spending guarantees.

## Data handling

Current feedback stays in browser storage until the visitor explicitly exports it. No automatic transcript or cloud-AI transfer is implemented. Personal takeaways are excluded from the community-feedback export.

Cloudflare's current standard Workers AI policy says inputs/outputs are not retained beyond processing and delivery, subject to exceptions; content is not used for model training. Stateful features, application/Gateway logging and external providers can change that retention boundary. This is a provider statement, not an audited guarantee or end-to-end encryption claim. [Data-usage terms](https://developers.cloudflare.com/workers-ai/platform/data-usage/)

Before hosted summaries, specify consent, processing recipients, region, retention, deletion, incident handling and audited administrative access. A server-side model processes supplied plaintext; “only the AI can see it” is not an appropriate promise. Obtain jurisdiction-specific privacy review before collecting public conversations.

## What is needed to launch

1. An explicit release approval covering the reviewed code/assets and public audience. The existing publication/licensing lane remains separate; do not merge or deploy by implication.
2. A hosting account and an approved monthly budget, region and plan. A provider subdomain is sufficient initially; no domain purchase is necessary.
3. Admission, mute/block/report and moderation appropriate to the audience. Temporary guest names do not establish identity or durable bans. Agent grants limit capabilities but do not solve anonymous abuse.
4. Durable accepted-world storage and restore tests before claiming persistent evolution. The current shared garden is deliberately session-scoped; local feedback is per-device. A free ephemeral disk is not persistence.
5. TURN and real microphone tests across different networks if voice is part of the launch promise.
6. A chosen inference account/model and explicit data/spend settings if live AI is enabled. The personal-agent protocol itself does not require us to buy model tokens; the owner supplies the agent.
7. A deployment rehearsal on the actual host: HTTPS, room isolation, scope denial, revoke/expiry, reconnect, rate/connection limits, restart, restore, real phones and measured capacity.

The current 12-avatar room and global connection limits are configuration, not proof of capacity. A 10,000-person community is neither 10,000 concurrent users nor a measured launch load. Begin with a few concurrent rooms only after the corresponding tests pass.

## Open-source handoff

This public source branch uses AGPL-3.0-only for current project code, retaining earlier MIT rights and third-party asset notices as described in `LICENSING.md`. Purchased assets, private research and credentials remain excluded. Publishing a source branch does not deploy the world; release and hosting decisions remain separate.
