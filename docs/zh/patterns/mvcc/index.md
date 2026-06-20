---
title: "模式：MVCC 多版本并发控制"
description: "为每个值保留多个带时间戳的版本，读者永远不阻塞写者——每个事务看到一致的快照，无需加锁。"
difficulty: "advanced"
---

# 模式：MVCC 多版本并发控制

<DifficultyBadge />

## 一句话

为每个值保留多个带时间戳的版本，读者永远不阻塞写者——每个事务看到一致的快照，无需加锁。

<DemoBadge />

## 现实类比

图书馆保留旧版和新版书。借了第 3 版的读者可以继续读，即使第 4 版已经上架。每个读者看到的是一个一致的快照——没人看到写了一半的更新。

## 核心思想

MVCC 将每次写入存储为带时间戳或事务 ID 的新版本。读者看到对其快照可见的最新版本，忽略并发写入。这消除了读写竞争：读者不阻塞写者，写者不阻塞读者。

```text
  键 "balance"
  ┌──────────┬──────────┬──────────┬──────────┐
  │ t=100    │ t=200    │ t=300    │ t=400    │
  │ val=500  │ val=450  │ val=600  │ val=580  │
  └──────────┴──────────┴──────────┴──────────┘

  事务 t=250:  看到 val=450  (最新版本 ≤ 250)
  事务 t=350:  看到 val=600  (最新版本 ≤ 350)
  两者读取时不阻塞 t=400 的写者。
```

| 属性 | 值 |
|------|------|
| 读写冲突 | **无** — 读者看自己的快照，写者追加新版本 |
| 写写冲突 | 提交时检测（先写者赢或中止） |
| 空间开销 | 每个键多个版本（通过压缩回收） |
| 隔离级别 | 快照隔离（强于读已提交，弱于可串行化） |

**动手试试** — 开始事务，读写键值，观察快照隔离：

<MVCCViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| PostgreSQL | [heapam_visibility.c#L917-L1096](https://github.com/postgres/postgres/blob/e18b0cb7344cb4bd28468f6c0aeeb9b9241d30aa/src/backend/access/heap/heapam_visibility.c#L917-L1096) | `HeapTupleSatisfiesMVCC` — 核心可见性检查。给定堆元组和 MVCC 快照，判断元组对当前事务是否可见。使用 `XidInMVCCSnapshot` 检查事务可见性，无需争用 `ProcArrayLock`。 |
| etcd | [kvstore.go#L53-L135](https://github.com/etcd-io/etcd/blob/e9b62f804766edf77cfa918d600cb6fb2c56b401/server/storage/mvcc/kvstore.go#L53-L135) | `store` 结构体（L53-L82）跟踪 `currentRev` 和 `compactMainRev`，用 B 树 `kvindex` 进行多版本查找。`NewStore`（L87-L135）初始化 MVCC 存储并从持久化修订重建内存索引。驱动 Kubernetes 的配置基础设施。 |

## 实现

::: code-group

```typescript [TypeScript]
interface Version<T> {
  timestamp: number;
  value: T;
  deleted: boolean;
}

class MVCCStore<T> {
  private store = new Map<string, Version<T>[]>();

  put(key: string, value: T, timestamp: number): void {
    if (!this.store.has(key)) this.store.set(key, []);
    this.store.get(key)!.push({ timestamp, value, deleted: false });
  }

  get(key: string, timestamp: number): T | undefined {
    const versions = this.store.get(key);
    if (!versions) return undefined;
    let best: Version<T> | undefined;
    for (const v of versions) {
      if (v.timestamp <= timestamp && (!best || v.timestamp > best.timestamp)) {
        best = v;
      }
    }
    return best && !best.deleted ? best.value : undefined;
  }

  delete(key: string, timestamp: number): void {
    if (!this.store.has(key)) this.store.set(key, []);
    this.store.get(key)!.push({ timestamp, value: undefined as T, deleted: true });
  }
}
```

```rust [Rust]
pub struct Version {
    pub timestamp: u64,
    pub value: Option<String>,
}

pub struct MVCCStore {
    data: std::collections::HashMap<String, Vec<Version>>,
}

impl MVCCStore {
    pub fn new() -> Self {
        MVCCStore { data: std::collections::HashMap::new() }
    }

    pub fn put(&mut self, key: &str, value: &str, ts: u64) {
        self.data.entry(key.to_string()).or_default()
            .push(Version { timestamp: ts, value: Some(value.to_string()) });
    }

    pub fn get(&self, key: &str, ts: u64) -> Option<&str> {
        let versions = self.data.get(key)?;
        let mut best: Option<&Version> = None;
        for v in versions {
            if v.timestamp <= ts && best.map_or(true, |b| v.timestamp > b.timestamp) {
                best = Some(v);
            }
        }
        best.and_then(|v| v.value.as_deref())
    }

    pub fn delete(&mut self, key: &str, ts: u64) {
        self.data.entry(key.to_string()).or_default()
            .push(Version { timestamp: ts, value: None });
    }
}
```

```go [Go]
type Version struct {
	Timestamp int
	Value     string
	Deleted   bool
}

type MVCCStore struct {
	data map[string][]Version
}

func NewMVCCStore() *MVCCStore {
	return &MVCCStore{data: make(map[string][]Version)}
}

func (s *MVCCStore) Put(key, value string, ts int) {
	s.data[key] = append(s.data[key], Version{Timestamp: ts, Value: value})
}

func (s *MVCCStore) Get(key string, ts int) (string, bool) {
	versions := s.data[key]
	var best *Version
	for i := range versions {
		v := &versions[i]
		if v.Timestamp <= ts && (best == nil || v.Timestamp > best.Timestamp) {
			best = v
		}
	}
	if best == nil || best.Deleted {
		return "", false
	}
	return best.Value, true
}

func (s *MVCCStore) Delete(key string, ts int) {
	s.data[key] = append(s.data[key], Version{Timestamp: ts, Deleted: true})
}
```

```python [Python]
from dataclasses import dataclass
from typing import Any

@dataclass
class Version:
    timestamp: int
    value: Any
    deleted: bool = False

class MVCCStore:
    def __init__(self):
        self._data: dict[str, list[Version]] = {}

    def put(self, key: str, value: Any, timestamp: int) -> None:
        self._data.setdefault(key, []).append(Version(timestamp, value))

    def get(self, key: str, timestamp: int) -> Any:
        versions = self._data.get(key, [])
        best = None
        for v in versions:
            if v.timestamp <= timestamp and (best is None or v.timestamp > best.timestamp):
                best = v
        if best is None or best.deleted:
            return None
        return best.value

    def delete(self, key: str, timestamp: int) -> None:
        self._data.setdefault(key, []).append(Version(timestamp, None, deleted=True))
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现多版本键值存储 | `exercises/typescript/mvcc/01-basic.test.ts` |
| 进阶 | 带一致性读取的快照事务 | `exercises/typescript/mvcc/02-intermediate.test.ts` |

运行练习：`pnpm test:ts`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/mvcc/mod.rs` · Go `exercises/go/mvcc/mvcc_test.go` · Python `exercises/python/mvcc/test_mvcc.py`

## 何时使用

- **数据库** — 并发事务的快照隔离（PostgreSQL、MySQL InnoDB）
- **分布式 KV 存储** — 无分布式锁的一致读（etcd、CockroachDB、TiKV）
- **时间旅行查询** — 读取过去某时间点的数据
- **乐观并发** — 提交时检测冲突而非预先加锁

## 何时不用

- **单写者系统** — 只有一个写者时 MVCC 开销不必要
- **内存受限** — 每个键多个版本消耗大量存储
- **只写不读** — 版本管理开销没有读者收益
- **需要严格可串行化** — MVCC 提供快照隔离；完全可串行化需要额外机制（SSI）

## 更多生产案例

- [CockroachDB](https://github.com/cockroachdb/cockroach/blob/5f5932a2bf50713ff76a0f859a41fd7985dec307/pkg/storage/mvcc.go#L1923-L1962) — 分布式 SQL 的 `MVCCPut` / `MVCCGet`
- [MySQL InnoDB](https://github.com/mysql/mysql-server) — undo log 实现 MVCC 行版本
- [TiKV](https://github.com/tikv/tikv) — 基于 Percolator 的分布式 MVCC 事务
- [FoundationDB](https://github.com/apple/foundationdb) — 多版本存储层

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [写时复制 (Copy-on-Write)](/zh/patterns/copy-on-write/) | MVCC 在写入时创建新版本，类似写时复制语义 |
| [逻辑时钟 / Epoch (Logical Clock)](/zh/patterns/logical-clock/) | 逻辑时钟提供 MVCC 依赖的版本时间戳 |
| [墓碑 / 延迟删除 (Tombstone)](/zh/patterns/tombstone/) | MVCC 用墓碑标记已删除版本，供后续垃圾回收 |
| [预写日志 (Write-Ahead Log)](/zh/patterns/write-ahead-log/) | WAL 确保 MVCC 版本变更在崩溃后幸存 |

## 挑战题

::: details Q1: 你的 MVCC 存储永久保留每个键的每个版本。运行一年后，存储使用量是实际活跃数据集的 50 倍。像 PostgreSQL 这样的生产数据库如何处理这个问题？
**答案：** 它们运行垃圾回收（在 PostgreSQL 中称为"vacuum"）来移除任何活跃事务都不再可见的版本。

PostgreSQL 的 `VACUUM` 进程识别"死"元组——比最旧活跃事务的快照更老的版本。由于没有任何事务能看到这些版本，它们可以安全回收。etcd 使用 `compaction` 来丢弃比阈值更老的修订版本。挑战在于确定"低水位线"：仍在使用的最旧快照。如果一个长时间运行的事务持有旧快照，它会阻止所有比该快照新的版本的垃圾回收——这是 PostgreSQL 膨胀的常见原因。
:::

::: details Q2: 两个事务都在相同的快照时间戳读取了键 "balance"（值=100），然后都尝试写入 "balance=90"（扣除 10）。在 MVCC 快照隔离下，两次读取都成功且不阻塞。提交时会发生什么？
**答案：** 一个事务成功提交；另一个检测到写-写冲突并中止。余额最终是 90，不是 80。

这是快照隔离下的"丢失更新"异常。两个事务读取相同的快照（balance=100）并独立计算 balance=90。MVCC 在提交时使用"先写者获胜"规则检测冲突：先提交的写入版本 t=200，值为 90。第二个事务尝试提交但发现 "balance" 在其快照之后被修改了——它必须中止并重试。重试时，它读取新值（90）并写入 80。这就是为什么 MVCC 提供的是快照隔离而非可序列化：它防止了丢失更新但需要应用层处理写冲突。
:::

::: details Q3: 你的团队在银行系统中使用 MVCC 快照隔离。合规审计问："两个并发的相同账户间转账能否产生不一致的总额？"你的团队说快照隔离能防止这种情况。他们说得对吗？
**答案：** 不对。快照隔离防止了丢失更新，但容易受到写偏斜异常的影响——两个事务读取重叠数据并进行互不冲突的写入，但这些写入合在一起违反了约束。

例子：账户 A=50 和 B=50，约束"A+B >= 0"。事务 1 读取两者，看到总额=100，写入 A=-10。事务 2 读取两者（相同快照，A=50，B=50），写入 B=-60。两者独立通过约束检查，两者都提交（它们写的是不同的键，所以没有写-写冲突），结果是 A=-10，B=-60，总额=-70——违反了约束。需要完全可序列化（PostgreSQL 的 SSI、CockroachDB 的可序列化模式）来防止写偏斜。
:::

::: details Q4: etcd 使用 MVCC 来支持 Kubernetes 的配置存储。为什么分布式键值存储受益于保留旧版本，而不是只存储最新值？
**答案：** 旧版本启用了 watch/subscribe 语义——客户端可以问"从修订版本 X 以来发生了什么变化？"而无需轮询，断开连接的客户端可以从其最后看到的修订版本追赶上来。

Kubernetes 控制器（如副本控制器）使用 etcd watch 来响应状态变化。如果 etcd 只存储最新值，断开 5 秒的控制器会错过中间变化并需要完全重新同步。有了 MVCC，控制器重连并说"给我修订版本 12345 以来的所有变化"，收到精确的变更流。这对 etcd 的一致性保证也至关重要：线性化读取可以从特定修订版本提供服务，时间旅行查询支持调试（"10 分钟前集群状态是什么？"）。
:::
