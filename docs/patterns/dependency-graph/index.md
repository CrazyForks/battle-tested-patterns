# Pattern: Dependency Graph

## One Liner

Model dependencies as a directed acyclic graph and topologically sort to determine a valid execution order — detecting cycles before they deadlock.

## Core Idea

A dependency graph represents items as nodes and ordering constraints as directed edges. `addEdge(A, B)` means "A must come before B" — A is a prerequisite of B. Topological sort (Kahn's algorithm) repeatedly removes zero-in-degree nodes, producing an ordering where every prerequisite appears before its dependents.

```text
  addEdge(wash, dry)     wash ──► dry ──► fold
  addEdge(dry, fold)          0        1       2
  addEdge(wash, fold)         │                ▲
                              └────────────────┘

  In-degree:  wash=0   dry=1   fold=2
  Output:     wash  →  dry  →  fold
  (zero in-degree first, then dependents)

  Cycle:  a → b → c → a  ← ERROR: no valid order
```

| Property | Value |
|----------|-------|
| Add node/edge | O(1) |
| Topological sort | O(V + E) — visit each node and edge once |
| Cycle detection | Built into topological sort (remaining nodes = cycle) |
| Space | O(V + E) — adjacency list |

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Cargo (Rust) | [dep_cache.rs#L1-L50](https://github.com/rust-lang/cargo/blob/master/src/cargo/core/resolver/dep_cache.rs#L1-L50) | `RegistryQueryer` manages the dependency resolution graph for Rust packages. Dependencies form a DAG resolved via backtracking, with the `resolve` function producing a topological ordering of crate versions for compilation. |
| pnpm | [graph-sequencer#L22-L125](https://github.com/pnpm/pnpm/blob/main/deps/graph-sequencer/src/index.ts#L22-L125) | `graphSequencer` — topologically sorts workspace packages by their inter-dependencies with cycle detection. Used by `pnpm -r` recursive commands to respect dependency ordering across a monorepo. |

## Implementation

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

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement topological sort with cycle detection | `exercises/typescript/dependency-graph/01-basic.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **Build systems** — compile dependencies before dependents (Make, Bazel, Cargo)
- **Package managers** — install/build order for workspace packages (pnpm, npm, yarn)
- **Task scheduling** — job orchestration with prerequisites (Airflow, CI/CD pipelines)
- **Module bundlers** — determine chunk splitting and loading order (webpack, Rollup)
- **Database migrations** — apply schema changes in dependency order

## When NOT to Use

- **Circular dependencies exist by design** — use a different model (e.g., event-driven, lazy evaluation)
- **No ordering needed** — if tasks are independent, a simple list suffices
- **Dynamic dependencies** — if edges change at runtime, incremental approaches are better
- **Very large graphs** — consider parallel algorithms (Kahn's is inherently sequential without modifications)

## More Production Uses

- [Make (GNU)](https://github.com/mirror/make) — prerequisite DAG determines target rebuild order
- [Bazel](https://github.com/bazelbuild/bazel) — action graph with topological execution phases
- [webpack](https://github.com/webpack/webpack) — `ModuleGraph` for chunk splitting and tree shaking
- [Terraform](https://github.com/hashicorp/terraform) — resource dependency graph for parallel apply
