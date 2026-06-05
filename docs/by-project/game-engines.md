---
description: "Game engine patterns from Godot and SDL: object pool, tagged union, double buffering, and dirty flag for 60fps performance."
---

# Patterns from Game Engines

Game engines push patterns to their limits — every frame counts at 60fps.

| Pattern | Project | Where | What It Does |
|---------|---------|-------|--------------|
| [Object Pool](/patterns/object-pool/) | Godot | [`core/templates/pooled_list.h`](https://github.com/godotengine/godot/blob/master/core/templates/pooled_list.h#L35-L100) | Freelist-based pool for entities, particles, physics bodies |
| [Double Buffering](/patterns/double-buffering/) | SDL | [`src/render/SDL_render.c`](https://github.com/libsdl-org/SDL/blob/main/src/render/SDL_render.c#L5535-L5570) | Front/back buffer swap for tear-free rendering |
| [Free List](/patterns/free-list/) | Godot | [`core/templates/pooled_list.h`](https://github.com/godotengine/godot/blob/master/core/templates/pooled_list.h#L35-L100) | Non-intrusive freelist allocator for O(1) entity alloc/free |
| [Ring Buffer](/patterns/ring-buffer/) | Game audio | Various engines | Lock-free audio streaming buffers between main and audio threads |
| [State Machine](/patterns/state-machine/) | Godot | [`scene/animation/animation_tree.h`](https://github.com/godotengine/godot/blob/master/scene/animation/animation_tree.h) | Animation state machines for character animation blending |
| [Arena Allocator](/patterns/arena-allocator/) | Frame allocators | Common pattern | Per-frame bump allocator — reset every frame, zero free cost |
| [Flyweight](/patterns/flyweight/) | Godot | [`servers/rendering/`](https://github.com/godotengine/godot/tree/master/servers/rendering) | Shared mesh/texture resources referenced by multiple instances |
| [Batch Processing](/patterns/batch-processing/) | Godot / Unity | Render batching | Batch draw calls to minimize GPU state changes |
| [Tagged Union](/patterns/tagged-union/) | Godot | [`variant.h`](https://github.com/godotengine/godot/blob/master/core/variant/variant.h#L78-L120) | `Variant::Type` enum + union — every GDScript value is a `Variant` |
| [Dirty Flag](/patterns/dirty-flag/) | Godot / Unity | Transform hierarchies | Dirty flag on parent transform invalidates child world matrices — recompute only when accessed |
| [Event Loop](/patterns/event-loop/) | Godot | [`main_loop.h`](https://github.com/godotengine/godot/blob/master/core/os/main_loop.h) | Main game loop — process input, update, render in fixed-step cycle |

## How They Compose: One Game Frame

At 60fps, each frame has ~16ms. Multiple patterns work together inside that budget:

<CompositionFlow variant="game-frame" />

The key insight: game engines minimize per-object overhead. Pools avoid malloc, dirty flags avoid recomputation, batching avoids GPU calls, and arenas avoid per-object deallocation. All of these share the same design philosophy — pay O(1) per operation, defer or amortize the expensive work.

## Further Reading

- [Godot Engine (GitHub)](https://github.com/godotengine/godot) · [SDL (GitHub)](https://github.com/libsdl-org/SDL)
- [Game Programming Patterns (book)](https://gameprogrammingpatterns.com/) by Robert Nystrom
