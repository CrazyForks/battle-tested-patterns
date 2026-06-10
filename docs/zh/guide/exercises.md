---
title: "练习指南"
description: "TypeScript、Rust、Go 和 Python 练习的分步设置指南 — 前置要求、测试运行方式和常见问题排查。"
---

# 练习指南

本项目包含 **4 种语言的练习** — TypeScript、Rust、Go 和 Python。每个模式在每种语言下至少有一个练习文件，内含可运行的实现和 `TODO` 标记供你重写。

## 前置要求

| 语言 | 版本要求 | 安装方式 |
|------|---------|---------|
| Node.js | v22 LTS | [nvm](https://github.com/nvm-sh/nvm) 或 [nodejs.org](https://nodejs.org/) |
| Rust | stable（最新） | [rustup.rs](https://rustup.rs/) |
| Go | 1.21+ | [go.dev/dl](https://go.dev/dl/) |
| Python | 3.10+ | [python.org](https://www.python.org/downloads/) 或系统包管理器 |

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/Totoro-jam/battle-tested-patterns.git
cd battle-tested-patterns

# 使用正确的 Node.js 版本
nvm use   # 读取 .nvmrc → Node 22
```

## 各语言设置

### TypeScript

```bash
# 安装依赖（仅需一次）
pnpm install

# 运行所有 TypeScript 练习
pnpm test

# 运行特定模式
pnpm test bitmask

# 监听模式 — 文件保存后自动重新运行
pnpm test -- --watch
```

**文件位置：** `exercises/typescript/<pattern-name>/01-basic.test.ts`

每个模式有 1–3 个按难度分级的练习文件（01-basic、02-intermediate、03-advanced）。

### Rust

```bash
# 无需额外安装 — Cargo 会自动处理

# 运行所有 Rust 练习
cd exercises/rust
cargo test

# 运行特定模式
cargo test bitmask

# 运行并显示输出
cargo test bitmask -- --nocapture
```

**文件位置：** `exercises/rust/src/<pattern_name>/mod.rs`

每个文件包含实现和测试，使用 `#[cfg(test)]` 在同一模块中。

### Go

```bash
# 无需额外安装 — Go modules 会处理依赖

# 运行所有 Go 练习
cd exercises/go
go test ./...

# 运行特定模式
go test -run Bitmask -v ./...

# 详细输出
go test -v ./...
```

**文件位置：** `exercises/go/<pattern_name>/<pattern_name>_test.go`

每个文件在同一 package 中包含实现和测试函数。

### Python

```bash
# 安装 pytest（仅需一次）
pip install pytest

# 运行所有 Python 练习
cd exercises/python
pytest

# 运行特定模式
pytest bitmask/test_bitmask.py

# 详细输出
pytest -v
```

**文件位置：** `exercises/python/<pattern_name>/test_<pattern_name>.py`

每个文件完全自包含 — 无跨文件导入。

## 练习机制

每个练习遵循 **TODO-stub 格式**：

1. 函数已有**可运行的实现**（确保 CI 始终通过）
2. `// TODO: implement` 标记指示需要重写的行
3. 分隔线以下的测试是**不可修改的** — 请勿修改
4. 删除函数体，从零实现，运行测试验证

### 示例工作流

```bash
# 1. 选择一个模式 — 比如 ring-buffer
# 2. 在编辑器中打开练习文件
# 3. 找到 TODO 标记
# 4. 删除实现代码，保留函数签名
# 5. 写你自己的实现
# 6. 运行测试检查：
pnpm test ring-buffer     # TypeScript
cargo test ring_buffer     # Rust
go test -run RingBuffer    # Go
pytest ring_buffer/test_ring_buffer.py # Python
```

### 分隔线

```text
// ─── Tests (do not modify below this line) ───────────────────────
```

分隔线以上是你的练习区域。分隔线以下是测试套件。

### 成功 / 失败示例

实现正确时：

```text
✓ Ring Buffer - Basic: should enqueue and dequeue in FIFO order (2ms)
✓ Ring Buffer - Basic: should reject enqueue when full
```

实现有误时：

```text
✗ Ring Buffer - Basic: should enqueue and dequeue in FIFO order
  → expected 1, got undefined
```

## 答案文件

参考实现位于 `exercises/answers/<language>/<pattern>/`：

```text
exercises/answers/
├── typescript/   # 46 个目录，每个一个 .ts 文件
├── rust/         # 46 个目录，每个一个 .rs 文件
├── go/           # 46 个目录，每个一个 .go 文件
└── python/       # 46 个目录，每个一个 .py 文件
```

这些文件包含纯实现代码（无测试）。可以用来对照检查或学习不同的实现方式。

## 一次运行所有语言

```bash
# 在项目根目录：
pnpm test                                  # TypeScript（491 个测试）
(cd exercises/rust && cargo test)          # Rust（173 个测试）
(cd exercises/go && go test ./...)         # Go（176 个测试）
(cd exercises/python && pytest)            # Python（233 个测试）
```

## 常见问题

| 问题 | 解决方案 |
|------|---------|
| `nvm: command not found` | 安装 nvm：`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh \| bash` |
| `pnpm: command not found` | 安装 pnpm：`npm install -g pnpm` |
| `rustup: command not found` | 安装 Rust：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| `go: command not found` | 从 [go.dev/dl](https://go.dev/dl/) 下载并添加到 PATH |
| `pytest: command not found` | `pip install pytest`（或 `pip3 install pytest`） |
| TypeScript 测试 import 报错 | 先运行 `pnpm install` |
| Rust 测试编译失败 | 运行 `rustup update` 获取最新稳定版 |
| Go 测试显示模块错误 | 在 `exercises/go/` 中运行 `go mod tidy` |
| Python `ModuleNotFoundError` | 每个文件自包含 — 无需额外导入 |
