---
title: '案例研究：Linux 如何组合三种模式来读取一个文件'
description: 深入剖析单次 read() 系统调用如何组合用于 VFS 分发的 vtable、用于权限位的 bitmask，以及用于保活资源的引用计数——每一处论断都由固定 commit 上的源码佐证。
---

# 案例研究：Linux 如何组合三种模式来读取一个文件

> **这是什么。** 大多数模式文档孤立地讲解一个模式。本案例研究反其道而行：它剖析单个真实系统——Linux 内核的 VFS 层——如何组合 **三种** 模式，使一次 `read()` 在 ext4 文件、套接字、`/proc` 条目上行为一致，廉价地检查权限，且永不释放仍在使用的资源。每一处针对单个模式的论断都链接到固定 commit 上的源码；组合关系的论证则由内核自己的文档支撑。

## Linux 解决的问题

"一切皆文件"是 Unix 的标志性抽象：同样的 `read()`、`write()`、`close()` 调用必须既能用于普通文件，也能用于管道、网络套接字或内核伪文件。但这些东西分属完全不同的子系统、有完全不同的代码。内核需要：

- 把 `read()` **分发**到正确的实现，且不靠一个对文件类型的庞大 `switch`；
- 在每次打开时**快速检查权限**，无论是什么文件系统；
- 在另一个进程仍在使用某个打开的文件时，**永不释放**它的资源——哪怕该文件在读取过程中被删除。

要同时做到这三点，需要三种模式协同工作。它们单独看都不新颖——真正有启发性的是*它们如何组合*。

| 问题 | 模式 | Linux 如何回答 |
|----------|---------|----------------------|
| *如何为任意文件类型运行正确的 `read()`？* | **Vtable** | `file_operations`——每种文件类型一份的函数指针结构体 |
| *如何廉价地检查权限？* | **Bitmask** | 把权限位（`rwxrwxrwx`）打包进一个整数 |
| *如何在使用期间保活一个资源？* | **引用计数** | `kref`——get 时自增，仅当计数归零时释放 |

## 模式 1 —— Vtable：一次调用，多种实现

内核中每个打开的文件都指向一个 `file_operations` 结构体：一张函数指针表。`read()` 不知道、也不关心这是什么类型的文件——它调用进文件的 `file_operations`。（`vfs_read` 会先尝试 `->read`，当 `->read` 缺失时经 `new_sync_read` 回退到 `->read_iter`——现代文件系统只提供 `->read_iter`。）ext4、套接字、`/proc` 各自提供它们*自己的* `file_operations`，于是同一个系统调用落到正确的代码里。

```c
struct file_operations {
  struct module *owner;
  fop_flags_t fop_flags;
  loff_t (*llseek) (struct file *, loff_t, int);
  ssize_t (*read) (struct file *, char __user *, size_t, loff_t *);
  ssize_t (*write) (struct file *, const char __user *, size_t, loff_t *);
  ssize_t (*read_iter) (struct kiocb *, struct iov_iter *);
  /* ...open, release, mmap, poll, ioctl... */
} __randomize_layout;
```

这就是一个 **vtable**：与 C++ 的虚方法表同一个思想，用 C 手写成一个函数指针结构体。无需继承的多态——内核通过一次指针间接获得按类型而异的行为，而不是一次类型判断。

::: tip 心智模型
把 `file_operations` 想成附在每个打开文件上的一张"这个文件能做什么"的菜单。`read()` 读菜单，调用菜单上列的那个 `read_iter`。换一张菜单（ext4 vs. 套接字），*同一个*系统调用就做了对的事——任何地方都没有 `if (is_socket) ... else if (is_ext4) ...`。
:::

→ 单独了解该模式，见 [Vtable](/zh/patterns/vtable/)。

## 模式 2 —— Bitmask：一个整数里的权限位

在 `read()` 能分发之前，文件必须已被打开，而打开必须通过一次权限检查。Unix 权限是教科书级的 **bitmask**：owner/group/other 的 `rwxrwxrwx` 三元组被打包进一个整数的低位。

```c
#define S_IRWXU 00700   /* owner:  read+write+execute */
#define S_IRUSR 00400   /* owner:  read */
#define S_IWUSR 00200   /* owner:  write */
#define S_IXUSR 00100   /* owner:  execute */
/* ...group (00070) and other (00007) follow the same layout... */
```

于是一次权限检查就是一次掩码比较——`mode & S_IRUSR`——而非一次结构遍历。这同一个打包整数从磁盘上的 inode 一路传到系统调用，每次检查都是一次按位与。

::: tip 心智模型
`rwxrwxrwx` 是九个是/否答案压进九个位。"owner 能读吗？"不是一次查找——它就是 `mode & 0o400`。八进制的 `0700`、`0640`、`0755` 只是一次取其中三个位。一个整数、九种权限、O(1) 检查。
:::

→ 单独了解该模式，见 [Bitmask](/zh/patterns/bitmask/)。

## 模式 3 —— 引用计数：不要释放仍在用的东西

一个打开的文件是共享的：多个进程（或多个文件描述符）可以持有同一个底层对象，而且该文件甚至可以在仍被打开时从目录树里被 *unlink*。所以内核不能在任何一个持有者用完时就释放该对象——它必须仅当 **最后一个** 持有者放手时才释放。这就是 **引用计数**，内核的通用机制是 `kref`：

```c
struct kobject *kobject_get(struct kobject *kobj)
{
  if (kobj) {
    /* ...warn if not initialized... */
    kref_get(&kobj->kref);   // bump the count: "I'm using this now"
  }
  return kobj;
}
```

每个持有者在开始使用对象时调用 `kobject_get`（count++），用完时调用 `kobject_put`（count--）；对象 *仅* 在计数归零时被释放。这正是"删除一个打开的文件"安全的原因：`unlink` 减掉一个引用，但字节会一直存活到最后一个读者的 `put`。

::: warning 实际保活文件的是哪个计数器
`kref`（这里通过 `kobject_get` 展示）是内核**通用**的引用计数惯用法——读懂该模式最清晰的地方。`read()` 路径上的 `struct file` 并非真的是一个 `kobject`；它用自己的 `f_count`（一个 `atomic_long`，由 `get_file` 自增、由 `fput` 释放），inode 用 `i_count`。机制不同，但模式——仅在最后一次释放时回收——是一致的。
:::

::: tip 心智模型
一个 `kref` 是一个"此刻有多少人正持有它"的计数器。这个资源像一个房间，仅当 *最后* 一个人离开时才自动上锁并清扫。删除文件只意味着"前门的名牌没了"——任何已经在里面的人都保留自己的副本，直到他们也走出去。
:::

→ 单独了解该模式，见 [Reference Counting](/zh/patterns/reference-counting/)。

## 三者如何组合

调用 `read(fd, buf, n)`，三个模式按顺序激活：

1. **Bitmask** 早已把关了产生 `fd` 的那次 `open()`：mode 位被 AND 检查过一次，与文件系统类型无关。
2. **引用计数** 在整个读取期间保活 `struct file`（及其 inode）——哪怕另一个进程同时删除了该文件——靠的是持有一个仅在 `close()` 时才放下的引用。
3. **Vtable** 分发真正的传输：`file->f_op->read_iter()` 运行 ext4 的、套接字的、或 `/proc` 的实现，没有类型 switch。

```text
read(fd, buf, n)
        │
        │  (open already passed the bitmask permission check: mode & S_IRUSR)
        ▼
   struct file (kept alive by kref — safe even if the file is unlinked)
        │
        ▼
   file->f_op->read_iter()   ◄── vtable dispatch: ext4 / socket / proc, same call
        │
        ▼
   bytes copied to user space
```

统一这一切的思想是 **在异构资源之上的统一接口**：vtable 让每种文件类型在 `read()` 看来都一样，bitmask 让每次权限检查无论什么文件系统都一样，引用计数让所有这些资源的生命周期管理都一样。去掉其中任意一个它都会崩塌：没有 vtable，`read()` 就需要一个对每种文件类型的 switch；没有 bitmask，权限检查就在热路径上变成结构遍历；没有引用计数，删除一个打开的文件就会释放另一个进程仍在读的内存——一次 use-after-free。

::: info 架构推断
把这三者描述为一个*有意组合*的设计——即"一切皆文件"抽象——依据的是内核的 VFS 文档（见延伸阅读），而非任何单个源码文件。针对单个模式的代码链接是直接的源码证据；而"被有意组合在一起"这一论断，由那些设计层级的材料支撑。
:::

## 生产验证

所有源码链接均固定到 Linux commit `acb7500801e98639f6d8c2d796ed9f64cba83d3a`。针对单个模式的论断属于 `source-code`（L1）；组合关系则由官方文档（`official-doc`）支撑。

| 模式 / 论断 | 来源 | 证据类型 | 在 `read()` 中的角色 |
|-----------------|--------|----------|------------------|
| Vtable | [fs.h#L1926-L1970](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/fs.h#L1926-L1970) | source-code | `struct file_operations`——按文件类型分发的函数指针表（`.read`、`.read_iter`、`.open`…） |
| Bitmask | [stat.h#L25-L41](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/uapi/linux/stat.h#L25-L41) | source-code | 打包进一个整数的权限位（`S_IRWXU`/`S_IRUSR`…）；检查就是 `mode & flag` |
| 引用计数 | [kobject.c#L636-L644](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/lib/kobject.c#L636-L644) | source-code | `kobject_get` 自增 `kref`；对象仅当计数归零时被释放 |
| 组合（有意为之） | [VFS documentation](https://www.kernel.org/doc/html/latest/filesystems/vfs.html) | official-doc | 内核自己对 `file_operations` 如何实现"一切皆文件"的解释 |

## 要点

- **模式很少单独出现。** 读取一个文件同时需要一个*分发*模式（vtable）、一个*访问控制*模式（bitmask）和一个*生命周期*模式（引用计数）——而且它们按顺序交接。
- **vtable 是 C 里的多态。** C++ 有虚方法的地方，内核手写一个函数指针结构体。把"函数指针结构体"认作 vtable，能解锁大多数 C 子系统的分发方式。
- **引用计数是让共享变安全的东西。** "删除一个打开的文件"能正确工作不是魔法——它就是一个把释放推迟到最后一个持有者离开的计数器。
- **这与 Go 运行时呼应。** 两者都用一张函数指针/接口表来抽象掉许多实现；读懂其中一个的热路径，会让另一个更易识别。

## 延伸阅读

一条从"我读过了"走向"我能在任何地方认出这些模式"的路径：

1. **先从抽象开始** —— 内核的 [VFS 文档](https://www.kernel.org/doc/html/latest/filesystems/vfs.html) 解释了 `file_operations` 为何存在、以及"一切皆文件"如何运作。先读这个；源码随后都在印证它。
2. **然后按这个顺序读源码** —— 分发表（[file_operations](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/fs.h#L1926-L1970)）→ 它据以把关的权限位（[mode bits](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/uapi/linux/stat.h#L25-L41)）→ 让它保活的计数器（[kobject_get](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/lib/kobject.c#L636-L644)）。
3. **本地动手实验** —— 运行 `stat -c '%a %A' somefile` 看同一个 mode 既显示为八进制*又*显示为 `rwx` 字母，然后 `ls -l /proc/self/fd` 观察引用计数如何让"已删除但仍打开"的文件保活。
4. **跨系统对比** —— 阅读 [Go 调度器案例研究](/zh/case-studies/go-scheduler)，注意 Go 的接口分发如何扮演与内核 vtable 相同的角色。同样的模式，不同的语言。
5. **练习这种识别力** —— 打开下面三个模式页，在你熟悉的另一个系统里寻找"函数指针结构体""打包进一个整数的标志""在最后一次释放时回收"。

## 延伸学习这些模式

- [Vtable](/zh/patterns/vtable/) —— 用于多态分发的函数指针表
- [Bitmask](/zh/patterns/bitmask/) —— 把多个标志打包进一个整数
- [Reference Counting](/zh/patterns/reference-counting/) —— 仅在最后一次释放时回收
