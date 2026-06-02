# Patterns from Other Projects

Beyond React, Linux, and Go, these patterns appear across a wide range of production systems.

## Git

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [Copy-on-Write](/patterns/copy-on-write/) | `object-file.c` | Content-addressed immutable objects; branches share objects, new commits only create objects for changed files |
| [Diff / Patch](/patterns/diff-patch/) | `diff.c`, `xdiff/` | Myers' diff algorithm computing minimal edit distance between file versions |

## Node.js

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [Observer / Pub-Sub](/patterns/observer/) | `lib/events.js` | `EventEmitter` — the foundation of Node's event-driven architecture |

## Redux

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [Observer / Pub-Sub](/patterns/observer/) | `createStore.ts` | `subscribe()` + `dispatch()` — listeners notified after every state change |

## Rust Standard Library

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [Copy-on-Write](/patterns/copy-on-write/) | `alloc/src/borrow.rs` | `Cow<'a, B>` — clone-on-write smart pointer for zero-copy parsing |

## XState

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [State Machine](/patterns/state-machine/) | `StateMachine.ts` | Industry-standard finite state machine library, used by Netflix, Microsoft, AWS |

## LMAX Disruptor

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [Ring Buffer](/patterns/ring-buffer/) | `RingBuffer.java` | Core data structure processing 6M orders/sec at LMAX Exchange |

## Godot Engine

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [Object Pool](/patterns/object-pool/) | `core/templates/pooled_list.h` | Freelist-based pool for game entities, particles, physics bodies |

## SDL

| Pattern | Where | What It Does |
|---------|-------|--------------|
| [Double Buffering](/patterns/double-buffering/) | `src/render/SDL_render.c` | Front/back buffer swap for tear-free frame presentation |
