# Pattern: Work Stealing

## One Liner

Idle threads steal tasks from busy threads' queues — balancing load dynamically without central coordination.

## Core Idea

Each worker owns a local deque (double-ended queue). Workers push/pop tasks from their own deque's top (LIFO for cache locality). When a worker's deque is empty, it steals from another worker's deque bottom (FIFO for fairness). This achieves automatic load balancing without a central scheduler bottleneck.

```text
  Worker 0 (busy)         Worker 1 (idle)        Worker 2 (busy)
  ┌──────────────┐        ┌──────────────┐       ┌──────────────┐
  │ Task D ← pop │        │   (empty)    │       │ Task G ← pop │
  │ Task C       │        │              │       │ Task F       │
  │ Task B       │◄───────│  STEAL ────►  │      │              │
  │ Task A       │  steal │              │       │              │
  └──────────────┘  from  └──────────────┘       └──────────────┘
        ↑ bottom                                        ↑ bottom
```

| Property | Value |
|----------|-------|
| Push/pop own | O(1) — no synchronization needed |
| Steal | O(1) — CAS on victim's deque bottom |
| Load balance | Automatic, decentralized |
| Cache locality | High — LIFO on own work, FIFO on stolen |

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Go runtime | [proc.go#L3836-L3903](https://github.com/golang/go/blob/master/src/runtime/proc.go#L3836-L3903) | `stealWork` — the goroutine scheduler's steal loop. Iterates 4× over all P's in random order, calling `runqsteal` (L7774-L7791) to CAS-grab half the runnable goroutines from a victim P's local run queue. Low-level `runqgrab` (L7706-L7769) uses atomic CAS on `runqhead`. |
| Tokio (Rust) | [worker.rs#L1136-L1175](https://github.com/tokio-rs/tokio/blob/master/tokio/src/runtime/scheduler/multi_thread/worker.rs#L1136-L1175) | `Core::steal_work` — iterates over remote workers from a random index, calls `steal_into` on each worker's steal queue. Only attempts stealing if fewer than half the workers are already searching. Falls back to the global inject queue. |

## Implementation

::: code-group

```typescript [TypeScript]
class WorkStealingScheduler {
  private queues: number[][];

  constructor(workerCount: number) {
    this.queues = Array.from({ length: workerCount }, () => []);
  }

  submit(task: number, workerIdx: number): void {
    this.queues[workerIdx]!.push(task);
  }

  run(process: (task: number) => number): number[] {
    const results: number[] = [];
    let anyWork = true;
    while (anyWork) {
      anyWork = false;
      for (let w = 0; w < this.queues.length; w++) {
        if (this.queues[w]!.length > 0) {
          anyWork = true;
          const task = this.queues[w]!.pop()!;
          results.push(process(task));
        } else {
          for (let other = 0; other < this.queues.length; other++) {
            if (other !== w && this.queues[other]!.length > 1) {
              anyWork = true;
              const stolen = this.queues[other]!.shift()!;
              results.push(process(stolen));
              break;
            }
          }
        }
      }
    }
    return results;
  }
}
```

```go [Go]
type WorkStealingScheduler struct {
	queues [][]int
}

func NewScheduler(workerCount int) *WorkStealingScheduler {
	queues := make([][]int, workerCount)
	for i := range queues {
		queues[i] = []int{}
	}
	return &WorkStealingScheduler{queues: queues}
}

func (s *WorkStealingScheduler) Submit(task, workerIdx int) {
	s.queues[workerIdx] = append(s.queues[workerIdx], task)
}

func (s *WorkStealingScheduler) Run(process func(int) int) []int {
	var results []int
	for {
		anyWork := false
		for w := 0; w < len(s.queues); w++ {
			if len(s.queues[w]) > 0 {
				anyWork = true
				last := len(s.queues[w]) - 1
				task := s.queues[w][last]
				s.queues[w] = s.queues[w][:last]
				results = append(results, process(task))
			} else {
				for other := 0; other < len(s.queues); other++ {
					if other != w && len(s.queues[other]) > 1 {
						anyWork = true
						stolen := s.queues[other][0]
						s.queues[other] = s.queues[other][1:]
						results = append(results, process(stolen))
						break
					}
				}
			}
		}
		if !anyWork {
			break
		}
	}
	return results
}
```

```python [Python]
from collections import deque

class WorkStealingScheduler:
    def __init__(self, worker_count: int):
        self.queues: list[deque[int]] = [deque() for _ in range(worker_count)]

    def submit(self, task: int, worker_idx: int) -> None:
        self.queues[worker_idx].append(task)

    def run(self, process) -> list[int]:
        results: list[int] = []
        while True:
            any_work = False
            for w in range(len(self.queues)):
                if self.queues[w]:
                    any_work = True
                    task = self.queues[w].pop()
                    results.append(process(task))
                else:
                    for other in range(len(self.queues)):
                        if other != w and len(self.queues[other]) > 1:
                            any_work = True
                            stolen = self.queues[other].popleft()
                            results.append(process(stolen))
                            break
            if not any_work:
                break
        return results
```

```rust [Rust]
use std::collections::VecDeque;

pub struct WorkStealingScheduler {
    queues: Vec<VecDeque<i32>>,
}

impl WorkStealingScheduler {
    pub fn new(worker_count: usize) -> Self {
        WorkStealingScheduler {
            queues: (0..worker_count).map(|_| VecDeque::new()).collect(),
        }
    }

    pub fn submit(&mut self, task: i32, worker_idx: usize) {
        self.queues[worker_idx].push_back(task);
    }

    pub fn run(&mut self, process: fn(i32) -> i32) -> Vec<i32> {
        let mut results = Vec::new();
        loop {
            let mut any_work = false;
            for w in 0..self.queues.len() {
                if !self.queues[w].is_empty() {
                    any_work = true;
                    let task = self.queues[w].pop_back().unwrap();
                    results.push(process(task));
                } else {
                    let len = self.queues.len();
                    for other in 0..len {
                        if other != w && self.queues[other].len() > 1 {
                            any_work = true;
                            let stolen = self.queues[other].pop_front().unwrap();
                            results.push(process(stolen));
                            break;
                        }
                    }
                }
            }
            if !any_work { break; }
        }
        results
    }
}
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a work-stealing scheduler with local deques | `exercises/typescript/work-stealing/01-basic.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **Parallel runtimes** — goroutine scheduler (Go), task scheduler (Tokio, Java ForkJoinPool)
- **Divide-and-conquer** — recursive task decomposition where subtasks vary in size
- **Irregular workloads** — when task durations are unpredictable
- **NUMA-aware scheduling** — steal from far only when local work is depleted

## When NOT to Use

- **Single-threaded** — no other workers to steal from
- **Uniform tasks** — static partitioning is simpler and equally effective
- **Very short tasks** — steal overhead dominates task execution time
- **Strict ordering** — work stealing disrupts FIFO order by design

## More Production Uses

- [Java ForkJoinPool](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/concurrent/ForkJoinPool.java) — `scan` method with randomized work stealing
- [Rayon (Rust)](https://github.com/rayon-rs/rayon) — data-parallelism library with work-stealing thread pool
- [Intel TBB](https://github.com/oneapi-src/oneTBB) — `task_arena` with work-stealing scheduler
- [Cilk](https://github.com/OpenCilk/opencilk-project) — pioneered work stealing for fork-join parallelism

## Challenge Questions

::: details Q1: Workers pop from their own deque using LIFO (top), but steal from others using FIFO (bottom). Why not use FIFO for both?
**Answer:** LIFO on your own deque gives cache locality -- the most recently pushed task is likely still in CPU cache. FIFO stealing takes the oldest (largest) task from the victim, giving the thief more work to do before needing to steal again.

In divide-and-conquer workloads, the bottom of the deque holds the earliest-spawned (coarsest-grained) tasks. Stealing one large task is better than stealing many small ones because it amortizes the steal overhead and gives the thief a chunk of work it can subdivide locally. LIFO for local pops also naturally implements depth-first execution, which uses less stack space.
:::

::: details Q2: Go's runtime steals half the victim's run queue instead of just one task. Why is "steal half" better than "steal one"?
**Answer:** Stealing one task means the thief may finish quickly and immediately need to steal again, causing repeated contention on the victim's deque. Stealing half amortizes the synchronization cost.

Each steal operation requires atomic CAS on the victim's deque, which is expensive. If you steal only one task, a worker with an empty queue may steal dozens of times per millisecond. Stealing half the queue in one operation means the thief has enough local work to stay busy, reducing total steal attempts and contention. The Go runtime's `runqgrab` does exactly this with a single atomic operation.
:::

::: details Q3: What is the ABA problem in the context of a lock-free work-stealing deque, and why does it matter?
**Answer:** The ABA problem occurs when a CAS succeeds because the value matches, but the underlying state has changed between the read and the CAS -- another thread modified and restored the original value.

In a lock-free deque, a thief reads the bottom index as value A, gets preempted, the owner pops and pushes (bottom goes A -> B -> A), and the thief's CAS on the bottom index succeeds even though the deque content is different. This can cause a task to be executed twice or skipped. The fix is to use a tagged pointer or generation counter so CAS detects the intermediate changes. This is why Tokio and Go use epoch/version counters alongside deque indices.
:::

::: details Q4: You have 8 workers and 8 identical long-running tasks, one per worker. Is work stealing helping here?
**Answer:** No. If every worker has exactly one task of equal duration, no worker finishes early, so no stealing ever occurs. Work stealing adds zero benefit and a small overhead from the idle-check logic.

Work stealing shines when workloads are irregular -- some tasks finish quickly and the worker can help others. With perfectly balanced, uniform tasks, static partitioning (assign one task per worker) is simpler and equally effective. Work stealing's overhead (deque management, random victim selection, CAS operations) is wasted when there's nothing to steal.
:::
