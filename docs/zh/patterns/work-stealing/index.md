---
title: "模式：工作窃取 (Work Stealing)"
description: "空闲线程从繁忙线程的队列中窃取任务——无需中央协调即可动态均衡负载。"
difficulty: "advanced"
---

# 模式：工作窃取 (Work Stealing)

<DifficultyBadge />

## 一句话

空闲线程从繁忙线程的队列中窃取任务——无需中央协调即可动态均衡负载。

<DemoBadge />

## 现实类比

超市的收银团队。当一个收银员处理完自己的队列，就走到最忙的收银台，从队尾接走几个顾客。工作自然从超载的通道流向空闲的通道。

## 核心思想

每个工作线程拥有一个本地双端队列（deque）。工作线程从自己的队列顶部 push/pop 任务（LIFO 利于缓存局部性）。当工作线程的队列为空时，它从其他工作线程的队列底部窃取任务（FIFO 保证公平性）。这实现了无中央调度器瓶颈的自动负载均衡。

```text
  Worker 0 (busy)         Worker 1 (idle)        Worker 2 (busy)
  ┌──────────────┐        ┌──────────────┐       ┌──────────────┐
  │ Task D ← pop │        │   (empty)    │       │ Task G ← pop │
  │ Task C       │        │              │       │ Task F       │
  │ Task B       │◄───────│  STEAL ────► │       │              │
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

**动手试试** — 给一个工作线程添加任务，启动处理后观察空闲线程窃取任务：

<WorkStealingViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Go runtime | [proc.go#L3836-L3903](https://github.com/golang/go/blob/f5cdf4745455415c7a43cfc7d925214d4511489b/src/runtime/proc.go#L3836-L3903) | `stealWork` — goroutine 调度器的窃取循环。随机顺序迭代所有 P 4 次，调用 `runqsteal`（L7774-L7791）从受害者 P 的本地运行队列中 CAS 抢占一半 goroutine。底层 `runqgrab`（L7706-L7769）使用原子 CAS 操作 `runqhead`。 |
| Tokio (Rust) | [worker.rs#L1136-L1175](https://github.com/tokio-rs/tokio/blob/bde89678532a8091d958268c0d36eac9362317d8/tokio/src/runtime/scheduler/multi_thread/worker.rs#L1136-L1175) | `Core::steal_work` — 从随机索引开始迭代远程 worker，对每个 worker 的窃取队列调用 `steal_into`。仅在不到一半 worker 正在搜索时才尝试窃取。回退到全局注入队列。 |

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

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带本地双端队列的工作窃取调度器 | `exercises/typescript/work-stealing/01-basic.test.ts` |
| 进阶 | 优先级工作窃取 — 高优先级任务优先执行 | `exercises/typescript/work-stealing/02-intermediate.test.ts` |

运行练习：`pnpm test:ts`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/work_stealing/mod.rs` · Go `exercises/go/work_stealing/work_stealing_test.go` · Python `exercises/python/work_stealing/test_work_stealing.py`

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

- [Java ForkJoinPool](https://github.com/openjdk/jdk/blob/4b3ec455c85314d051800a8f46dd8f5c93881e3a/src/java.base/share/classes/java/util/concurrent/ForkJoinPool.java) — `scan` 方法实现随机化工作窃取
- [Rayon (Rust)](https://github.com/rayon-rs/rayon) — 数据并行库，内置工作窃取线程池
- [Intel TBB](https://github.com/oneapi-src/oneTBB) — `task_arena` 工作窃取调度器
- [Cilk](https://github.com/OpenCilk/opencilk-project) — fork-join 并行的工作窃取先驱

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [协作调度 (Cooperative Scheduling)](/zh/patterns/cooperative-scheduling/) | 工作窃取在线程间分配任务；协作调度在线程内让出 |
| [对象池 (Object Pool)](/zh/patterns/object-pool/) | 工作线程使用线程本地对象池避免争用 |
| [空闲链表 (Free List)](/zh/patterns/free-list/) | 线程本地空闲链表通过提供无锁分配来补充工作窃取 |

## 挑战题

::: details Q1: Worker 从自己的双端队列使用 LIFO（顶部）弹出，但从其他 Worker 处使用 FIFO（底部）窃取。为什么不两者都用 FIFO？
**答案：** 从自己的双端队列使用 LIFO 提供缓存局部性——最近推入的任务很可能仍在 CPU 缓存中。FIFO 窃取从受害者那里取走最旧（最大）的任务，给窃取者更多工作做，从而在需要再次窃取之前持续更久。

在分治工作负载中，双端队列的底部持有最早产生的（粒度最粗的）任务。窃取一个大任务比窃取多个小任务好，因为它摊销了窃取开销并给窃取者一块可以在本地细分的工作。本地弹出使用 LIFO 也自然实现了深度优先执行，使用更少的栈空间。
:::

::: details Q2: Go 的运行时从受害者的运行队列中窃取一半而非仅一个任务。为什么"窃取一半"比"窃取一个"好？
**答案：** 只窃取一个任务意味着窃取者可能很快完成并立即需要再次窃取，导致对受害者双端队列的重复竞争。窃取一半摊销了同步成本。

每次窃取操作需要对受害者双端队列的原子 CAS，这代价很高。如果你只窃取一个任务，一个队列为空的 Worker 可能每毫秒窃取几十次。在一次操作中窃取队列的一半意味着窃取者有足够的本地工作保持忙碌，减少总窃取尝试次数和竞争。Go 运行时的 `runqgrab` 正是用单次原子操作做到这一点的。
:::

::: details Q3: 在无锁工作窃取双端队列的上下文中，什么是 ABA 问题？为什么它很重要？
**答案：** ABA 问题发生在 CAS 因为值匹配而成功，但在读取和 CAS 之间底层状态已经改变——另一个线程修改了然后又恢复了原始值。

在无锁双端队列中，窃取者读取底部索引为值 A，被抢占，所有者弹出又推入（底部从 A -> B -> A），窃取者对底部索引的 CAS 成功了，即使双端队列内容不同。这可能导致任务被执行两次或被跳过。修复方法是使用标记指针或代计数器使 CAS 能检测到中间的变化。这就是 Tokio 和 Go 在双端队列索引旁边使用 epoch/版本计数器的原因。
:::

::: details Q4: 你有 8 个 Worker 和 8 个相同的长时间运行任务，每个 Worker 一个。工作窃取在这里有帮助吗？
**答案：** 没有。如果每个 Worker 恰好有一个相同持续时间的任务，没有 Worker 会提前完成，所以永远不会发生窃取。工作窃取带来零收益和来自空闲检查逻辑的少量开销。

工作窃取在工作负载不均匀时发挥优势——一些任务很快完成，Worker 可以帮助其他的。在完美平衡、统一的任务下，静态分配（每个 Worker 分配一个任务）更简单且同样有效。工作窃取的开销（双端队列管理、随机受害者选择、CAS 操作）在没有东西可窃取时都是浪费的。
:::
