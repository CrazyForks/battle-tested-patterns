# SOP 15: Case Study Authoring

## Trigger

- Writing a new case study under `docs/case-studies/`
- Updating an existing case study's claims, sources, or structure
- Periodic re-verification of case study source links (CI cron + before release)

> **This SOP is a living document.** Case study methodology evolves as we write
> more of them. Whenever a new case study surfaces a new evidence type, review
> dimension, or tooling integration, update this SOP in the same change. Quantity
> compounds into quality — every iteration should leave the standard sharper than
> before.

## Purpose

A case study differs from a pattern doc: instead of teaching **one** pattern, it
dissects how a **real production system composes multiple patterns** to solve a
hard problem (e.g. "How React Fiber combines bitmask + min-heap + cooperative
scheduling"). Because a case study makes *combination* claims, the bar for
evidence is higher than a single pattern's Production Proof.

This SOP codifies how to keep every claim **reliable, trustworthy, and
verifiable** — the same L1 standard the rest of the project holds
(SHA permalink + line range + HTTP 200), extended to multi-pattern composition.

## Core Principle: No Claim Without Evidence

> If you are not certain, research top-tier projects and real source code first.
> Never write a claim you cannot back with a verifiable link or a clearly
> labelled inference.

Evidence reliability hierarchy (from `v2-evolution-plan.md` §4):

| Level | Standard | Reference exemplars |
|-------|----------|---------------------|
| L1 | Verifiable source link (SHA permalink + line range, HTTP 200) | Jepsen.io, this project |
| L2 | Paper / official documentation citation | DDIA (Kleppmann), aosabook.org |
| L3 | Reasonable inference (MUST be explicitly labelled) | patterns.dev, System Design Primer |

A case study's **per-pattern** claims must reach **L1**. Architecture-level
*composition* claims (how the patterns fit together) may rest on L2/L3 but MUST
be labelled (see §4).

## 1. Evidence Type Labelling

Every source in a case study's evidence table carries an explicit evidence type.

```markdown
| Pattern | Source | Evidence | Role in the system |
|---------|--------|----------|--------------------|
| Bitmask | [ReactFiberFlags.js#L14-L36](SHA-permalink) | source-code | Side-effect flags |
| Scheduling | [React Conf 2017](talk-url) | conference-talk | Cooperative model |
```

Evidence type enumeration (keep in sync with `check-structure.ts` C1/C2):

- `source-code` — direct source link (SHA + line range), the strongest
- `official-doc` — official documentation page
- `official-blog` — official engineering blog
- `academic-paper` — peer-reviewed or canonical paper
- `conference-talk` — recorded talk by a project maintainer/author
- `inferred` — reasonable inference; REQUIRES an explanation block (§4)

## 2. Per-Pattern Independent Evidence (the hard rule)

A case study claims "System X uses patterns A, B, C **together**". To be
trustworthy:

- **Each pattern needs its own source link.** One link MUST NOT cover multiple
  pattern claims. If you claim React Fiber uses both a min-heap and a bitmask,
  that is two separate `source-code` links, not one.
- **The composition relationship needs its own evidence** beyond the individual
  links — typically an RFC, design doc, or maintainer talk (`official-doc` /
  `academic-paper` / `conference-talk`). Individual source links prove each
  pattern exists; they do NOT prove they were *combined by design*.
- **No bundling.** Do not paraphrase a single file as evidence for an
  architectural argument it does not itself make.

## 3. Version / Commit Locking

Source code drifts; SHA permalinks do not. Every source link MUST be a SHA
permalink (never a branch link), and the prose MUST state the version/commit
context when behaviour is version-specific.

```markdown
> As of React 18 (commit `abc1234`): Fiber encodes side-effect flags as a
> bitmask in `ReactFiberFlags.js`...
```

Run before committing:

```bash
tsx scripts/convert-to-sha-links.ts --dry-run   # find branch links
tsx scripts/convert-to-sha-links.ts             # batch-convert to SHA
```

## 4. Labelling Inferred Claims

Composition/architecture claims that are NOT directly provable from a single
source MUST be wrapped in an explicit inference callout, citing what they rest
on:

```markdown
::: info Architectural inference
The following describes how these patterns interact, based on the React team's
public RFC and conference talks rather than a single source file.
Source: [React Fiber Architecture](url) (Sebastian Markbåge, 2016)
:::
```

Never let an inference masquerade as a verified fact. Honesty about the
evidence boundary is the project's differentiator.

## 5. Dual-Perspective Review (mandatory before "done")

Every case study MUST pass review from **two** perspectives. Do not mark a case
study complete until both pass.

### Perspective A — The Reader (a learner new to the system)

- [ ] Can I follow the narrative without already knowing the system internals?
- [ ] Is each pattern introduced before it is used in the composition argument?
- [ ] Are diagrams clear; does the "why these patterns together" payoff land?
- [ ] Are jargon and version specifics explained, not assumed?

### Perspective B — The Senior Engineer (deep expert on this system)

- [ ] Is every claim technically correct at the cited commit?
- [ ] Does each source link actually demonstrate the claimed pattern (open it)?
- [ ] Are composition claims backed by design-level evidence, not hand-waving?
- [ ] Would I, as a maintainer of this system, sign off on this description?
- [ ] Are inferred claims honestly labelled and not overstated?

## 6. Toolchain Integration

A case study lives under `docs/` and is therefore covered by the existing link
verifiers — no new tooling required, but you MUST run them:

```bash
pnpm verify-links                 # HTTP 200 + Production-Proof line-number rules
pnpm verify-lines                 # line ranges in bounds + pattern keywords present
pnpm check:content                # EN/ZH parity (case studies are bilingual too)
pnpm verify-mermaid               # only if mermaid diagrams are used
```

Notes on how the verifiers see case studies:

- `verify-source-links.ts` extracts every `https://github.com/...` link. Links
  under a `## Production Proof` / `## 生产验证` heading are held to the
  line-number rule; structure your evidence table accordingly so per-pattern
  source links are treated as proofs.
- SHA permalinks are immutable, so "content drift" cannot happen by design; the
  line-range check (`verify-lines`) guards against an out-of-bounds range after
  a SHA bump.
- Case studies are bilingual: keep `docs/case-studies/<slug>.md` and
  `docs/zh/case-studies/<slug>.md` structurally in sync (`check:content`).

## 7. Authoring Checklist (run top to bottom)

- [ ] Topic chosen: a real system composing ≥ 2 documented patterns
- [ ] Each pattern claim has its own `source-code` SHA permalink (§2)
- [ ] Composition claim has design-level evidence (RFC/doc/talk) (§2)
- [ ] Every source is labelled with an evidence type (§1)
- [ ] Version/commit context stated where behaviour is version-specific (§3)
- [ ] Inferred claims wrapped in inference callouts (§4)
- [ ] EN + ZH versions written and structurally in sync
- [ ] `pnpm verify-links && pnpm verify-lines && pnpm check:content` all pass
- [ ] Dual-perspective review passed (Reader + Senior Engineer) (§5)
- [ ] This SOP updated if the case study surfaced a new rule or evidence type

## Related SOPs

- SOP 02 (Verify Source) — link verification mechanics
- SOP 06 (Broken Link Fix) — when a source link breaks
- SOP 13 (Content Quality Audit) — section/EN-ZH/diagram quality dimensions
- `v2-evolution-plan.md` §4 — origin of this methodology
