# TODOs

## Replay Annotation (Post-v2)
**What:** After each game, generate a shareable "architecture postmortem" that annotates each routing decision with the real-world system design concept it maps to.
**Why:** Every match produces a unique, personalized system design explainer. Junior devs posting "I just learned why caching matters by losing a card game" is the growth loop.
**Context:** The routing state machine already records every decision (routingContext.steps). Replays fall out almost free. Cross-model consensus from office hours + eng review identified this as the highest-value extension.
**Depends on:** Routing state machine stable after playtesting.

## Solo Puzzle Mode (Post-v2)
**What:** Pre-built scenarios where you're given a broken architecture and a traffic pattern, and you have to fix the system before requests start failing. LeetCode for system design.
**Why:** 10x vision from office hours. Makes the game accessible to solo players and turns it into a teaching tool that bootcamps could assign as homework.
**Context:** The routing state machine (routing.ts) is the foundation. Solo mode = pre-configured GameState + fixed client deck + win condition on score threshold. The v2 resolution-first rewrite was chosen specifically to enable this.
**Depends on:** Routing state machine stable, base game playtested.

## Service Card Expansion (Post-v3)
**What:** Add more service cards beyond Payment Service: auth service, CDN, monitoring, rate limiter. Each introduces a third-party dependency with its own failure modes and routing behavior.
**Why:** The 'service' card type introduced in v3 for Payment Service creates a reusable extension point. More service cards add strategic depth and teach real-world third-party integration patterns (auth failures, CDN cache misses, monitoring overhead).
**Context:** v3 adds `CardType: 'service'` and `AT_SERVICE` routing state for Payment Service. The infrastructure supports any number of service cards. Natural fit for deck building: server player chooses which third-party services to integrate.
**Depends on:** v3 stable, base game playtested with service card routing.
