---
title: "如何贡献"
description: "如何贡献新模式：验证要求、源码链接标准、多语言实现指南。"
---

# 如何贡献

欢迎参与贡献！以下是入门指南。

## 快速开始

```bash
git clone https://github.com/Totoro-jam/battle-tested-patterns.git
cd battle-tested-patterns
pnpm install
pnpm dev        # 启动文档站开发服务器
pnpm test       # 运行全部测试：docs 组件 + 四种语言的练习
```

## 贡献类型

### 添加新模式

1. 开一个 [Issue](https://github.com/Totoro-jam/battle-tested-patterns/issues/new?template=new-pattern.md) 提议该模式
2. 遵循 [SOP 01: 新增模式](https://github.com/Totoro-jam/battle-tested-patterns/blob/e758be266d38db94723be233863e6f3effbf46cc/.sop/01-new-pattern.md)
3. 提交 PR 并填写完整的 checklist

### 添加语言实现

- 选择一个缺少你擅长语言的模式
- 遵循 [SOP 03: 多语言实现](https://github.com/Totoro-jam/battle-tested-patterns/blob/e758be266d38db94723be233863e6f3effbf46cc/.sop/03-multi-lang-impl.md)
- 实现必须**地道** — 不能逐行翻译

### 修复失效链接

- 遵循 [SOP 06: 失效链接修复](https://github.com/Totoro-jam/battle-tested-patterns/blob/e758be266d38db94723be233863e6f3effbf46cc/.sop/06-broken-link-fix.md)

### 改进文档

- 修正拼写、澄清说明、改进图示
- 修订已有内容用 commit 类型 `docs:`；新增整个内容单元（新模式、案例研究或指南页）时用 `feat:`

## 质量标准

每个模式必须满足以下最低要求：

- ≥ 2 个生产验证，附带精确到行号的 GitHub 链接
- TypeScript 实现 + ≥ 1 种其他语言（Rust/Go/Python）
- 4 种语言的练习文件（TS、Rust、Go、Python）+ 答案文件
- 中文翻译且代码块一致
- 所有测试通过（`pnpm test` 一次运行四种语言 + docs），无 lint 错误

完整检查清单见 [PR 模板](https://github.com/Totoro-jam/battle-tested-patterns/blob/e758be266d38db94723be233863e6f3effbf46cc/.github/PULL_REQUEST_TEMPLATE.md)。

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
feat: add cooperative-scheduling pattern
fix: update broken Linux source link in bitmask
docs: improve Core Idea diagram for double-buffering
test: add advanced exercise for min-heap
ci: add Go test step to CI workflow
chore: update dependencies
```

按**面向读者的影响**选择类型，而非按改了哪些文件：

- **新增整个内容单元**（模式、案例研究、指南页）→ `feat:`
  （这才会提升版本号，并作为里程碑出现在 changelog 中）。
- **修订已有内容**（深化、润色、修正措辞）→ `docs:`
  （会显示在 changelog 中，但不提升版本号）。
- **纯内部改动** —— `.sop/` 更新、工具链、配置 → `chore:`
  （不进入面向读者的 changelog）。
