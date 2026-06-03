import { describe, it, expect } from 'vitest';

/**
 * Dependency Graph - Intermediate: Parallel Execution Planner.
 *
 * TODO: Given a dependency graph, compute execution "waves" — groups
 * of nodes that can run in parallel. Wave 0 contains nodes with no
 * dependencies; wave 1 contains nodes whose deps are all in wave 0;
 * and so on. Each wave is sorted alphabetically for determinism.
 *
 * Real-world use: CI/CD pipeline stages, Makefile -j parallelism,
 * Terraform resource graph, monorepo build ordering.
 */

class ExecutionPlanner {
  private adjacency = new Map<string, Set<string>>();

  addNode(node: string): void {
    if (!this.adjacency.has(node)) this.adjacency.set(node, new Set());
  }

  /** Declare that `from` depends on `to` (to must complete before from). */
  addDependency(from: string, to: string): void {
    // TODO: implement
    this.addNode(from);
    this.addNode(to);
    this.adjacency.get(from)!.add(to);
  }

  /**
   * Return execution waves. Each wave is an array of nodes that can
   * run concurrently. Waves are ordered so that all dependencies of
   * wave N are in waves < N. Nodes within a wave are sorted alphabetically.
   * Throws if a cycle is detected.
   */
  planWaves(): string[][] {
    // TODO: implement
    // Compute in-degree for each node
    const inDegree = new Map<string, number>();
    for (const node of this.adjacency.keys()) inDegree.set(node, 0);

    for (const [, deps] of this.adjacency) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
      }
    }

    // BFS by levels (waves)
    const waves: string[][] = [];
    let currentWave: string[] = [];

    for (const [node, degree] of inDegree) {
      if (degree === 0) currentWave.push(node);
    }

    let processed = 0;

    while (currentWave.length > 0) {
      currentWave.sort();
      waves.push(currentWave);
      processed += currentWave.length;

      const nextWave: string[] = [];
      for (const node of currentWave) {
        for (const dep of this.adjacency.get(node) ?? []) {
          const newDegree = inDegree.get(dep)! - 1;
          inDegree.set(dep, newDegree);
          if (newDegree === 0) nextWave.push(dep);
        }
      }
      currentWave = nextWave;
    }

    if (processed !== this.adjacency.size) {
      throw new Error('Cycle detected');
    }

    // Reverse: the first wave should have leaf dependencies (no deps),
    // the last wave should have the root nodes
    return waves.reverse();
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Dependency Graph - Intermediate: Parallel Execution Planner', () => {
  it('should produce one node per wave for a linear chain', () => {
    const planner = new ExecutionPlanner();
    planner.addDependency('build', 'compile');
    planner.addDependency('compile', 'parse');

    const waves = planner.planWaves();
    expect(waves).toEqual([['parse'], ['compile'], ['build']]);
  });

  it('should parallelize independent branches in a diamond', () => {
    const planner = new ExecutionPlanner();
    // deploy depends on test-unit and test-e2e
    // both test-unit and test-e2e depend on build
    planner.addDependency('deploy', 'test-unit');
    planner.addDependency('deploy', 'test-e2e');
    planner.addDependency('test-unit', 'build');
    planner.addDependency('test-e2e', 'build');

    const waves = planner.planWaves();
    expect(waves).toHaveLength(3);
    expect(waves[0]).toEqual(['build']);
    expect(waves[1]).toEqual(['test-e2e', 'test-unit']); // parallel, sorted
    expect(waves[2]).toEqual(['deploy']);
  });

  it('should put all independent nodes in a single wave', () => {
    const planner = new ExecutionPlanner();
    planner.addNode('lint');
    planner.addNode('format');
    planner.addNode('typecheck');
    planner.addNode('audit');

    const waves = planner.planWaves();
    expect(waves).toHaveLength(1);
    expect(waves[0]).toEqual(['audit', 'format', 'lint', 'typecheck']);
  });

  it('should handle mixed parallel and sequential deps', () => {
    const planner = new ExecutionPlanner();
    planner.addDependency('publish', 'test');
    planner.addDependency('publish', 'lint');
    planner.addDependency('test', 'build');
    planner.addDependency('lint', 'build');
    planner.addDependency('build', 'install');

    const waves = planner.planWaves();
    expect(waves).toHaveLength(4);
    expect(waves[0]).toEqual(['install']);
    expect(waves[1]).toEqual(['build']);
    expect(waves[2]).toEqual(['lint', 'test']); // parallel
    expect(waves[3]).toEqual(['publish']);
  });

  it('should return empty array for empty graph', () => {
    const planner = new ExecutionPlanner();
    expect(planner.planWaves()).toEqual([]);
  });
});
