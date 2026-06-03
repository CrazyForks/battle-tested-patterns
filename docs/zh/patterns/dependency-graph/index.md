# 模式：依赖图 (Dependency Graph)

## 一句话

将依赖关系建模为有向无环图，拓扑排序确定合法执行顺序——在死锁前检测循环。

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

## 挑战题

::: details Q1: Given a dependency graph where A->C, B->C, and A and B have no dependencies, how many tasks can run in parallel? How does topological sort reveal this?
**Answer:** A and B can run in parallel (both have in-degree 0). C must wait for both. Maximum parallelism is 2.

Topological sort using Kahn's algorithm naturally exposes parallelism: all nodes with in-degree 0 at any given step can execute simultaneously. In this example, the first "wave" is {A, B} (both in-degree 0), and the second wave is {C} (in-degree drops to 0 after both A and B complete). Build systems like Bazel and Make exploit this by processing each wave in parallel.
:::

::: details Q2: Package D depends on both B and C. B depends on A. C also depends on A. This is a "diamond dependency." Does topological sort handle it correctly?
**Answer:** Yes. Topological sort handles diamonds correctly because it tracks in-degree, not paths. A runs first, then B and C (in parallel), then D.

A diamond is not a cycle -- it's just two paths converging on the same node. Kahn's algorithm processes A (in-degree 0), decrements B and C's in-degrees to 0, processes both, then decrements D's in-degree to 0 and processes it. The potential problem is not in ordering but in version conflicts: if B needs A v1 and C needs A v2, you have a compatibility issue that the graph structure alone doesn't solve.
:::

::: details Q3: You change file `utils.ts` in a large project. An incremental build system only recompiles files that depend on `utils.ts`. How does the dependency graph enable this?
**Answer:** The build system walks the dependency graph forward from `utils.ts`, collecting all transitive dependents. Only those files (plus `utils.ts` itself) need recompilation.

This is the key advantage of maintaining a dependency graph over a flat file list. Without the graph, you'd have to recompile everything or maintain manual lists of dependencies. With the graph, you compute the affected subgraph in O(V+E) time. Tools like webpack's `ModuleGraph` and Bazel's action graph do exactly this -- they track which outputs depend on which inputs and invalidate only the affected subtree.
:::

::: details Q4: A developer adds a dependency from module A to module B, but B already transitively depends on A (B -> C -> A). What should the build system do?
**Answer:** Reject the change. Adding A -> B creates a cycle (A -> B -> C -> A), which means there is no valid build order.

Kahn's algorithm detects this: after processing all zero-in-degree nodes, some nodes remain with non-zero in-degree -- those nodes form the cycle. The build system should report the exact cycle path so the developer can redesign the dependency (e.g., extract shared code into a new module, use dependency inversion, or use lazy/dynamic imports to break the compile-time cycle).
:::
