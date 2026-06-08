# 参与贡献 Battle-Tested Patterns

感谢你的贡献意愿！本项目收集经过生产验证的编程模式，附带精确源码链接、多语言实现和可运行练习。

## 开始之前

1. 阅读 [SOPs](../.sop/README.md) — 特别是 [SOP 01: 新增模式](../.sop/01-new-pattern.md)
2. 查看已有的[模式](../docs/patterns/)避免重复
3. 先开一个 Issue 讨论新模式，然后再提交 PR

## 什么是好的模式？

- **经过生产验证**：在 ≥ 2 个真实项目中使用（附可验证的源码链接）
- **跨语言通用**：不限于单一语言或框架
- **代码级技巧**：具体的技术，而非抽象的架构概念
- **可教学**：能用图表说明并配套练习

## 添加新模式

遵循 [SOP 01: 新增模式](../.sop/01-new-pattern.md)。简要流程：

1. **验证**模式在 ≥ 2 个生产代码库中存在
2. **编写**模式文档，遵循[模板](../CLAUDE.md)
3. **实现** TypeScript（必须）+ 至少 1 种其他语言
4. **创建** 4 种语言的练习文件（TS、Rust、Go、Python）+ 答案文件
5. **验证**所有源码链接返回 HTTP 200
6. **提交** PR 并填写完整的 checklist

## 源码链接要求

这是我们的核心差异化——每个声明都必须可验证：

```text
✅ https://github.com/facebook/react/blob/main/.../ReactFiberFlags.js#L18-L22
❌ https://github.com/facebook/react/tree/main/packages/  （目录，不够精确）
❌ Feature branch 链接（可能被删除）
❌ 未经 curl -I 验证的链接
```

## 代码标准

- **TypeScript**：strict 模式，无 `any`，Vitest 测试
- **Rust**：地道风格，`#[cfg(test)]` 模块，`cargo test`
- **Go**：优先标准库，表驱动测试，`go test`
- **提交**：[Conventional Commits](https://www.conventionalcommits.org/)（`feat:`、`fix:`、`docs:` 等）

## 本地运行

```bash
pnpm install                          # 安装依赖
pnpm dev                              # 启动文档站开发服务器
pnpm test                             # 运行 TypeScript 练习（Vitest）
pnpm lint                             # Lint Markdown
pnpm typecheck                        # TypeScript 类型检查
pnpm verify-code                      # 验证所有代码块可编译
pnpm verify-links                     # 验证源码链接
cd exercises/rust && cargo test       # 运行 Rust 练习
cd exercises/go && go test ./...      # 运行 Go 练习
cd exercises/python && pytest         # 运行 Python 练习
```

## PR 流程

1. Fork 并创建分支：`feat/add-<pattern-name>`
2. 遵循 PR 模板中的模板和 checklist
3. 确保 CI 全绿
4. 等待 review（参见 [SOP 05](../.sop/05-pr-review.md)）

## 容易上手的贡献

还没准备好完成一个完整模式？以下是很好的入门方式：

- **添加语言实现** — 选择一个缺少 Rust/Go/Python 实现的模式，添加地道的版本
- **添加练习** — 为现有模式编写新的测试场景
- **改进图表** — 让 ASCII 图表更清晰或修复对齐
- **修复失效链接** — 上游仓库重构后，源码链接可能失效
- **翻译** — 改进中文翻译或添加新内容

请查看标记为 [`good first issue`](https://github.com/Totoro-jam/battle-tested-patterns/labels/good%20first%20issue) 的 Issue。

## 报告问题

- **失效链接**：使用 [broken-link 模板](ISSUE_TEMPLATE/broken-link.md)
- **新模式建议**：使用 [new-pattern 模板](ISSUE_TEMPLATE/new-pattern.md)
- **其他**：直接开一个 Issue，附上相关上下文

## 行为准则

本项目遵循 [Contributor Covenant 行为准则](../CODE_OF_CONDUCT.md)。尊重他人、建设性交流、专注质量。我们重视准确性胜过速度。
