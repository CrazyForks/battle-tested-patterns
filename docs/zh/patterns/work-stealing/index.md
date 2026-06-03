# 模式：工作窃取 (Work Stealing)

## 一句话

空闲线程从繁忙线程的队列中窃取任务——无需中央协调即可动态均衡负载。

## 核心思想

每个工作线程拥有一个本地双端队列（deque）。工作线程从自己的队列顶部 push/pop 任务（LIFO 利于缓存局部性）。当工作线程的队列为空时，它从其他工作线程的队列底部窃取任务（FIFO 保证公平性）。这实现了无中央调度器瓶颈的自动负载均衡。

```text
  Worker 0 (繁忙)         Worker 1 (空闲)        Worker 2 (繁忙)
  ┌──────────────┐        ┌──────────────┐       ┌──────────────┐
  │ Task D ← pop │        │   (空)       │       │ Task G ← pop │
  │ Task C       │        │              │       │ Task F       │
  │ Task B       │◄───────│    窃取 ────►│       │              │
  │ Task A       │  steal │              │       │              │
  └──────────────┘  from  └──────────────┘       └──────────────┘
        ↑ bottom                                        ↑ bottom
```

| 属性 | 值 |
|------|------|
| 自身 Push/Pop | O(1) — 无需同步 |
| 窃取 | O(1) — 对受害者队列底部做 CAS |
| 负载均衡 | 自动、去中心化 |
| 缓存局部性 | 高 — 自身任务 LIFO，窃取任务 FIFO |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Go runtime | [proc.go#L3836-L3903](https://github.com/golang/go/blob/master/src/runtime/proc.go#L3836-L3903) | `stealWork` — goroutine 调度器的窃取循环。随机顺序迭代所有 P 4 次，调用 `runqsteal`（L7774-L7791）从受害者 P 的本地运行队列中 CAS 抢占一半 goroutine。底层 `runqgrab`（L7706-L7769）使用原子 CAS 操作 `runqhead`。 |
| Tokio (Rust) | [worker.rs#L1136-L1175](https://github.com/tokio-rs/tokio/blob/master/tokio/src/runtime/scheduler/multi_thread/worker.rs#L1136-L1175) | `Core::steal_work` — 从随机索引开始迭代远程 worker，对每个 worker 的窃取队列调用 `steal_into`。仅在不到一半 worker 正在搜索时才尝试窃取。回退到全局注入队列。 |

## 实现

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

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带本地双端队列的工作窃取调度器 | `exercises/typescript/work-stealing/01-basic.test.ts` |

## 何时使用

- **并行运行时** — goroutine 调度器（Go）、任务调度器（Tokio、Java ForkJoinPool）
- **分治算法** — 子任务大小不均匀的递归任务分解
- **不规则工作负载** — 任务持续时间不可预测时
- **NUMA 感知调度** — 本地工作耗尽后才从远端窃取

## 何时不用

- **单线程** — 没有其他 worker 可窃取
- **均匀任务** — 静态分区更简单且同样有效
- **极短任务** — 窃取开销超过任务执行时间
- **严格有序** — 工作窃取会打乱 FIFO 顺序

## 更多生产案例

- [Java ForkJoinPool](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/concurrent/ForkJoinPool.java) — `scan` 方法实现随机化工作窃取
- [Rayon (Rust)](https://github.com/rayon-rs/rayon) — 数据并行库，内置工作窃取线程池
- [Intel TBB](https://github.com/oneapi-src/oneTBB) — `task_arena` 工作窃取调度器
- [Cilk](https://github.com/OpenCilk/opencilk-project) — fork-join 并行的工作窃取先驱

## 挑战题

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
