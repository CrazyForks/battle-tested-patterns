---
description: "将依赖关系建模为有向无环图，拓扑排序确定合法执行顺序——在死锁前检测循环。"
---

# 模式：依赖图 (Dependency Graph)

## 一句话

将依赖关系建模为有向无环图，拓扑排序确定合法执行顺序——在死锁前检测循环。

<DemoBadge />

## 核心思想

依赖图将项目表示为节点，排序约束表示为有向边。`addEdge(A, B)` 表示"A 必须在 B 之前"——A 是 B 的前置条件。Kahn 算法反复移除入度为 0 的节点，产生一个每个前置条件都在其依赖者之前的顺序。

```text
  addEdge(wash, dry)     wash ──► dry ──► fold
  addEdge(dry, fold)          0        1       2
  addEdge(wash, fold)         │                ▲
                              └────────────────┘

  入度:   wash=0   dry=1   fold=2
  输出:   wash  →  dry  →  fold
  (入度为 0 的先输出)

  循环:  a → b → c → a  ← 错误：不存在合法顺序
```

| 属性 | 值 |
|------|------|
| 添加节点/边 | O(1) |
| 拓扑排序 | O(V + E) — 每个节点和边访问一次 |
| 循环检测 | 内置于拓扑排序（剩余节点 = 循环） |
| 空间 | O(V + E) — 邻接表 |

**动手试试** — 添加节点和边，然后运行拓扑排序，观察 Kahn 算法逐步处理：

<DependencyGraphViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Cargo (Rust) | [dep_cache.rs#L1-L50](https://github.com/rust-lang/cargo/blob/master/src/cargo/core/resolver/dep_cache.rs#L1-L50) | `RegistryQueryer` 管理 Rust 包的依赖解析图。依赖形成通过回溯解析的 DAG，`resolve` 函数产生 crate 版本的拓扑排序用于编译。 |
| pnpm | [graph-sequencer#L22-L125](https://github.com/pnpm/pnpm/blob/main/deps/graph-sequencer/src/index.ts#L22-L125) | `graphSequencer` — 按工作区包的相互依赖关系进行拓扑排序并检测循环。被 `pnpm -r` 递归命令使用，在 monorepo 中遵循依赖顺序。 |

## 实现

::: code-group

```typescript [TypeScript]
class DependencyGraph<T> {
  private adjacency = new Map<T, Set<T>>();

  addNode(node: T): void {
    if (!this.adjacency.has(node)) this.adjacency.set(node, new Set());
  }

  addEdge(from: T, to: T): void {
    this.addNode(from);
    this.addNode(to);
    this.adjacency.get(from)!.add(to);
  }

  topologicalSort(): T[] {
    const inDegree = new Map<T, number>();
    for (const node of this.adjacency.keys()) inDegree.set(node, 0);
    for (const [, deps] of this.adjacency) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
      }
    }

    const queue: T[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) queue.push(node);
    }

    const result: T[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const dep of this.adjacency.get(node) ?? []) {
        const newDegree = inDegree.get(dep)! - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) queue.push(dep);
      }
    }

    if (result.length !== this.adjacency.size) {
      throw new Error('Cycle detected');
    }
    return result;
  }
}
```

```go [Go]
type DependencyGraph struct {
	adj map[string][]string
}

func NewDependencyGraph() *DependencyGraph {
	return &DependencyGraph{adj: make(map[string][]string)}
}

func (g *DependencyGraph) AddNode(node string) {
	if _, ok := g.adj[node]; !ok {
		g.adj[node] = nil
	}
}

func (g *DependencyGraph) AddEdge(from, to string) {
	g.AddNode(from)
	g.AddNode(to)
	g.adj[from] = append(g.adj[from], to)
}

func (g *DependencyGraph) TopologicalSort() ([]string, error) {
	inDegree := make(map[string]int)
	for node := range g.adj {
		inDegree[node] = 0
	}
	for _, deps := range g.adj {
		for _, dep := range deps {
			inDegree[dep]++
		}
	}

	var queue []string
	for node, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, node)
		}
	}
	sort.Strings(queue)

	var result []string
	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]
		result = append(result, node)
		for _, dep := range g.adj[node] {
			inDegree[dep]--
			if inDegree[dep] == 0 {
				queue = append(queue, dep)
			}
		}
	}

	if len(result) != len(g.adj) {
		return nil, fmt.Errorf("cycle detected")
	}
	return result, nil
}
```

```python [Python]
from collections import deque

class DependencyGraph:
    def __init__(self):
        self.adj: dict[str, list[str]] = {}

    def add_node(self, node: str) -> None:
        if node not in self.adj:
            self.adj[node] = []

    def add_edge(self, from_node: str, to_node: str) -> None:
        self.add_node(from_node)
        self.add_node(to_node)
        self.adj[from_node].append(to_node)

    def topological_sort(self) -> list[str]:
        in_degree: dict[str, int] = {n: 0 for n in self.adj}
        for deps in self.adj.values():
            for dep in deps:
                in_degree[dep] = in_degree.get(dep, 0) + 1

        queue = deque(n for n, d in in_degree.items() if d == 0)
        result: list[str] = []

        while queue:
            node = queue.popleft()
            result.append(node)
            for dep in self.adj.get(node, []):
                in_degree[dep] -= 1
                if in_degree[dep] == 0:
                    queue.append(dep)

        if len(result) != len(self.adj):
            raise ValueError("Cycle detected")
        return result
```

```rust [Rust]
use std::collections::HashMap;

pub struct DependencyGraph {
    adj: HashMap<String, Vec<String>>,
}

impl DependencyGraph {
    pub fn new() -> Self {
        DependencyGraph { adj: HashMap::new() }
    }

    pub fn add_node(&mut self, node: &str) {
        self.adj.entry(node.to_string()).or_default();
    }

    pub fn add_edge(&mut self, from: &str, to: &str) {
        self.add_node(from);
        self.add_node(to);
        self.adj.get_mut(from).unwrap().push(to.to_string());
    }

    pub fn topological_sort(&self) -> Result<Vec<String>, &'static str> {
        let mut in_degree: HashMap<&str, usize> = HashMap::new();
        for node in self.adj.keys() {
            in_degree.entry(node.as_str()).or_insert(0);
        }
        for deps in self.adj.values() {
            for dep in deps {
                *in_degree.entry(dep.as_str()).or_insert(0) += 1;
            }
        }

        let mut queue: Vec<&str> = in_degree.iter()
            .filter(|(_, &d)| d == 0)
            .map(|(&n, _)| n)
            .collect();
        queue.sort();

        let mut result = Vec::new();
        while let Some(node) = queue.first().copied() {
            queue.remove(0);
            result.push(node.to_string());
            if let Some(deps) = self.adj.get(node) {
                for dep in deps {
                    let d = in_degree.get_mut(dep.as_str()).unwrap();
                    *d -= 1;
                    if *d == 0 {
                        queue.push(dep.as_str());
                        queue.sort();
                    }
                }
            }
        }

        if result.len() != self.adj.len() {
            return Err("Cycle detected");
        }
        Ok(result)
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带循环检测的拓扑排序 | `exercises/typescript/dependency-graph/01-basic.test.ts` |
| 进阶 | 并行执行规划器 — 计算执行波次 | `exercises/typescript/dependency-graph/02-intermediate.test.ts` |

运行练习：`pnpm test`

## 何时使用

- **构建系统** — 依赖先于被依赖者编译（Make、Bazel、Cargo）
- **包管理器** — 工作区包的安装/构建顺序（pnpm、npm、yarn）
- **任务调度** — 带前置条件的作业编排（Airflow、CI/CD 流水线）
- **模块打包器** — 确定代码分割和加载顺序（webpack、Rollup）
- **数据库迁移** — 按依赖顺序应用 schema 变更

## 何时不用

- **设计上存在循环依赖** — 使用不同模型（如事件驱动、惰性求值）
- **不需要排序** — 任务独立时简单列表即可
- **动态依赖** — 运行时边变化时，增量方法更好
- **超大图** — 考虑并行算法（Kahn 算法天然串行，需要改造）

## 更多生产案例

- [Make (GNU)](https://github.com/mirror/make) — 前置条件 DAG 决定目标重建顺序
- [Bazel](https://github.com/bazelbuild/bazel) — action 图的拓扑执行阶段
- [webpack](https://github.com/webpack/webpack) — `ModuleGraph` 用于代码分割和 tree shaking
- [Terraform](https://github.com/hashicorp/terraform) — 资源依赖图实现并行 apply

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [访问者 / 树遍历器 (Visitor / Tree Walker)](/zh/patterns/visitor/) | 依赖图上的树遍历分发到类型特定的处理器 |
| [迭代器 / 惰性求值 (Iterator)](/zh/patterns/iterator/) | 拓扑迭代生成按依赖顺序的惰性节点序列 |
| [脏标记 (Dirty Flag)](/zh/patterns/dirty-flag/) | 脏传播沿依赖边标记下游节点以进行重计算 |

## 挑战题

::: details Q1: 给定一个依赖图，其中 A->C、B->C，且 A 和 B 没有依赖。可以并行运行多少个任务？拓扑排序如何揭示这一点？
**答案：** A 和 B 可以并行运行（两者入度都为 0）。C 必须等待两者完成。最大并行度为 2。

使用 Kahn 算法的拓扑排序自然地暴露了并行性：在任何给定步骤中，所有入度为 0 的节点可以同时执行。在这个例子中，第一"波"是 {A, B}（都是入度 0），第二波是 {C}（在 A 和 B 都完成后入度降为 0）。像 Bazel 和 Make 这样的构建系统正是通过并行处理每一波来利用这一点的。
:::

::: details Q2: 包 D 依赖 B 和 C。B 依赖 A。C 也依赖 A。这是一个"菱形依赖"。拓扑排序能正确处理吗？
**答案：** 可以。拓扑排序正确处理菱形依赖，因为它追踪的是入度而不是路径。A 先运行，然后 B 和 C（并行），最后 D。

菱形不是环——它只是两条路径汇聚到同一个节点。Kahn 算法处理 A（入度 0），将 B 和 C 的入度减为 0，处理两者，然后将 D 的入度减为 0 并处理它。潜在问题不在于排序，而在于版本冲突：如果 B 需要 A v1 而 C 需要 A v2，你就有了一个仅靠图结构无法解决的兼容性问题。
:::

::: details Q3: 你在一个大项目中修改了文件 `utils.ts`。增量构建系统只重新编译依赖 `utils.ts` 的文件。依赖图是如何实现这一点的？
**答案：** 构建系统从 `utils.ts` 出发沿依赖图正向遍历，收集所有传递依赖者。只有这些文件（加上 `utils.ts` 本身）需要重新编译。

这是维护依赖图相比于扁平文件列表的关键优势。没有图，你要么重新编译所有文件，要么手动维护依赖列表。有了图，你可以在 O(V+E) 时间内计算受影响的子图。像 webpack 的 `ModuleGraph` 和 Bazel 的 action graph 这样的工具正是这样做的——它们追踪哪些输出依赖于哪些输入，只使受影响的子树失效。
:::

::: details Q4: 一个开发者添加了从模块 A 到模块 B 的依赖，但 B 已经传递依赖 A（B -> C -> A）。构建系统应该怎么做？
**答案：** 拒绝这个变更。添加 A -> B 会形成环（A -> B -> C -> A），这意味着不存在有效的构建顺序。

Kahn 算法会检测到这一点：在处理完所有入度为零的节点后，仍有一些节点的入度非零——这些节点形成了环。构建系统应该报告确切的环路径，以便开发者重新设计依赖关系（例如将共享代码提取到新模块中、使用依赖反转，或使用延迟/动态导入来打破编译时的循环）。
:::
