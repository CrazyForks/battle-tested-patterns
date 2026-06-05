# Plan: Python 练习 + 答案分离 + 多角色全面审查

## Context

项目已有 4 种语言的参考实现（TS、Rust、Go、Python），但练习只覆盖 3 种语言（无 Python）。现有练习采用"答案预填 + TODO 注释"模式让 CI 通过，但没有独立的答案参考位置。用户要求：
1. 增加 Python 练习（46 个模式）
2. 答案需有独立存放位置（即使练习本身是骨架模式）
3. 启动多角色 agent 全面审查练习质量和一致性

## 现状

| 语言 | 练习文件 | 测试数 | 格式 |
|------|---------|--------|------|
| TypeScript | 93 个 .test.ts（46×2 + bitmask×3） | 491 | 函数体预填 + `// TODO` 标记 + 测试在分隔线下 |
| Rust | 47 个 .rs 模块 | 171 | 实现 + #[cfg(test)] 在同一文件 |
| Go | 46 个 _test.go | ~170 | 实现 + Test 函数在同一文件 |
| Python | **0** | 0 | 不存在 |

- 每个 pattern docs 页面 Implementation 章节有完整 Python 参考实现可提取
- 无独立 `answers/` 或 `solutions/` 目录

## 方案

### 1. Python 练习

**目录**：`exercises/python/`

```
exercises/python/
├── conftest.py              # pytest 配置（如有需要）
├── requirements.txt         # pytest
├── test_bitmask.py
├── test_lru_cache.py
├── ...（共 46 个 test_ 文件）
└── test_write_ahead_log.py
```

**格式**：与 Rust/Go 一致 — 实现 + 测试在同一文件。函数/类带 `# TODO: implement` 标记，实现体预填（CI 通过），学习者删除重写。

**来源**：从 `docs/patterns/<name>/index.md` 提取 Python 代码块 → 编写匹配的 pytest 测试（参考同模式的 Go/Rust 测试场景保持一致）。

### 2. 答案独立存放

创建 `exercises/answers/` 目录：

```
exercises/answers/
├── README.md                # 说明用途
├── typescript/
│   ├── bitmask.ts           # 纯实现，无测试
│   └── ...
├── rust/
│   ├── bitmask.rs
│   └── ...
├── go/
│   ├── bitmask.go
│   └── ...
└── python/
    ├── bitmask.py
    └── ...
```

答案文件 = docs/ 页面 Implementation 章节的纯实现代码（无测试）。

### 3. CI 集成

`.github/workflows/ci.yml` 添加 `test-python` job：

```yaml
test-python:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
    - run: pip install pytest
    - run: cd exercises/python && pytest -v
```

### 4. 文档更新

- 每个 pattern 的 Exercises 章节添加 Python 文件引用
- CLAUDE.md 更新命令：`pytest` (Python)
- 运行指令更新为：`pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

### 5. 多角色全面审查

完成实现后，启动 3 个并行 agent：

| 角色 | 审查重点 |
|------|---------|
| **跨语言一致性审计** | 4 种语言的练习是否覆盖相同测试场景？命名/结构是否一致？ |
| **学习者体验** | TODO 标记是否清晰？难度梯度是否合理？答案与练习是否对应？ |
| **CI/测试工程师** | pytest 集成是否正确？所有 4 种语言测试是否通过？答案文件是否可独立运行？ |

## 执行顺序

1. **Phase 1**：创建 Python 练习（46 文件），分 5 批
   - 批次 1：数据结构（11 个）
   - 批次 2：并发（9 个）
   - 批次 3：系统（12 个）
   - 批次 4：内存（8 个）
   - 批次 5：行为型（6 个）
2. **Phase 2**：创建 `exercises/answers/` 答案目录（4 语言 × 46 = 184 文件）
3. **Phase 3**：CI 配置 + 文档更新
4. **Phase 4**：多角色审查 + 修复发现的问题
5. **Phase 5**：提交、推送、打 tag

## 关键文件

| 文件 | 操作 |
|------|------|
| `exercises/python/test_*.py` | 创建 46 个 |
| `exercises/python/conftest.py` | 创建 |
| `exercises/python/requirements.txt` | 创建 |
| `exercises/answers/**` | 创建 184 个 |
| `.github/workflows/ci.yml` | 编辑，添加 test-python |
| `docs/patterns/*/index.md` | 编辑 Exercises 章节（46 个） |
| `CLAUDE.md` | 编辑命令说明 |

## 验证

1. `cd exercises/python && pytest -v` — 全部通过
2. `pnpm test` — TS 491 测试不受影响
3. `cargo test` — Rust 171 测试不受影响
4. `go test ./...` — Go 测试不受影响
5. `pnpm build` — 文档构建通过
6. Push 后 CI 全绿（含新 test-python job）
