---
title: 'Case Study: How Linux Composes Three Patterns to Read a File'
description: A deep dive into how a single read() syscall combines a vtable for VFS dispatch, a bitmask for permission bits, and reference counting to keep resources alive — every claim backed by source code at a pinned commit.
---

# Case Study: How Linux Composes Three Patterns to Read a File

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — the Linux kernel's
> VFS layer — composes **three** patterns so that a single `read()` works
> identically on an ext4 file, a socket, or a `/proc` entry, checks permissions
> cheaply, and never frees a resource that is still in use. Every per-pattern
> claim links to source code at a pinned commit; the composition argument is
> backed by the kernel's own documentation.

## The Problem Linux Solves

"Everything is a file" is Unix's defining abstraction: the same `read()`,
`write()`, and `close()` calls must work whether the target is a regular file, a
pipe, a network socket, or a kernel pseudo-file. But these live in completely
different subsystems with completely different code. The kernel needs to:

- **dispatch** `read()` to the right implementation without a giant `switch` on
  file type;
- **check permissions** quickly, on every open, regardless of filesystem;
- **never free** an open file's resources while another process is still using
  it — even if the file is deleted mid-read.

Achieving all three at once needs three patterns working together. None is novel
alone — what is instructive is *how they compose*.

| Question | Pattern | How Linux answers it |
|----------|---------|----------------------|
| *How do we run the right `read()` for any file type?* | **Vtable** | `file_operations` — a struct of function pointers per file type |
| *How do we check permissions cheaply?* | **Bitmask** | Mode bits (`rwxrwxrwx`) packed into one integer |
| *How do we keep a resource alive while in use?* | **Reference counting** | `kref` — increment on get, free only when the count hits zero |

## Pattern 1 — Vtable: one call, many implementations

Every open file in the kernel points at a `file_operations` struct: a table of
function pointers. `read()` does not know or care what kind of file it is — it
calls into the file's `file_operations`. (`vfs_read` first tries `->read`, and
falls back to `->read_iter` via `new_sync_read` when `->read` is absent —
modern filesystems supply only `->read_iter`.) ext4, a socket, and `/proc` each
supply their *own* `file_operations`, so the same syscall lands in the right code.

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

This is a **vtable**: the same idea as a C++ virtual method table, hand-rolled in
C as a struct of function pointers. Polymorphism without inheritance — the kernel
gets per-type behaviour through a pointer indirection, not a type check.

::: tip Mental model
Think of `file_operations` as a "what this file can do" menu attached to every
open file. `read()` reads the menu and calls whatever `read_iter` the menu lists.
Swap the menu (ext4 vs. socket) and the *same* syscall does the right thing — no
`if (is_socket) ... else if (is_ext4) ...` anywhere.
:::

→ For the pattern in isolation, see [Vtable](/patterns/vtable/).

## Pattern 2 — Bitmask: permission bits in one integer

Before `read()` can dispatch, the file had to be opened, and the open had to pass
a permission check. Unix permissions are the textbook **bitmask**: the
`rwxrwxrwx` triplet for owner/group/other is packed into a single integer's low
bits.

```c
#define S_IRWXU 00700   /* owner:  read+write+execute */
#define S_IRUSR 00400   /* owner:  read */
#define S_IWUSR 00200   /* owner:  write */
#define S_IXUSR 00100   /* owner:  execute */
/* ...group (00070) and other (00007) follow the same layout... */
```

A permission check is then a single masked compare — `mode & S_IRUSR` — rather
than a structure walk. The same packed integer travels from the on-disk inode all
the way to the syscall, and every check is one bitwise AND.

::: tip Mental model
`rwxrwxrwx` is nine yes/no answers compressed into nine bits. "Can the owner
read?" is not a lookup — it is `mode & 0o400`. Octal `0700`, `0640`, `0755` are
just three of those bits at a time. One integer, nine permissions, O(1) checks.
:::

→ For the pattern in isolation, see [Bitmask](/patterns/bitmask/).

## Pattern 3 — Reference counting: don't free what's in use

An open file is shared: multiple processes (or multiple file descriptors) can
hold the same underlying object, and the file can even be *unlinked* from the
directory tree while still open. So the kernel cannot free the object when any
one holder is done — it must free it only when the **last** holder lets go. That
is **reference counting**, and the kernel's generic mechanism is `kref`:

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

Every holder calls `kobject_get` (count++) when it starts using the object and
`kobject_put` (count--) when done; the object is released *only* when the count
reaches zero. This is what makes "delete an open file" safe: `unlink` drops one
reference, but the bytes survive until the last reader's `put`.

::: warning Which counter actually holds the file
`kref` (shown here via `kobject_get`) is the kernel's **generic** reference-count
idiom — the clearest place to read the pattern. The `struct file` on the `read()`
path is not literally a `kobject`; it uses its own `f_count` (an `atomic_long`,
bumped by `get_file`, dropped by `fput`), and the inode uses `i_count`. The
mechanism differs, but the pattern — free only on the last release — is identical.
:::

::: tip Mental model
A `kref` is a "how many people are holding this right now" counter. The resource
is a room that auto-locks-and-cleans only when the *last* person leaves. Deleting
the file just means "the front door's nameplate is gone" — anyone already inside
keeps their copy until they too walk out.
:::

→ For the pattern in isolation, see [Reference Counting](/patterns/reference-counting/).

## How the Three Compose

Call `read(fd, buf, n)` and the three patterns activate in order:

1. **Bitmask** already gated the `open()` that produced `fd`: the mode bits were
   AND-checked once, regardless of filesystem type.
2. **Reference counting** keeps the `struct file` (and its inode) alive for the
   whole duration of the read — even if another process deletes the file
   meanwhile — by holding a reference that is only dropped on `close()`.
3. **Vtable** dispatches the actual transfer: `file->f_op->read_iter()` runs
   ext4's, the socket's, or `/proc`'s implementation, with no type switch.

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

The unifying idea is **a uniform interface over heterogeneous resources**: the
vtable makes every file type look the same to `read()`, the bitmask makes every
permission check the same regardless of filesystem, and reference counting makes
lifetime management the same for all of them. Remove any one and it breaks:
without the vtable, `read()` needs a switch over every file type; without the
bitmask, permission checks become structure walks on the hot path; without
reference counting, deleting an open file would free memory another process is
still reading — a use-after-free.

::: info Architectural inference
The framing of these three as a *deliberately composed* design — the "everything
is a file" abstraction — rests on the kernel's VFS documentation (see Further
Reading), not on any single source file. The per-pattern code links are direct
source-code evidence; the "combined by design" claim is supported by that
design-level material.
:::

## Production Proof

All source links are pinned to Linux commit
`acb7500801e98639f6d8c2d796ed9f64cba83d3a`. Per-pattern claims are
`source-code` (L1); the composition relationship is backed by official
documentation (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in `read()` |
|-----------------|--------|----------|------------------|
| Vtable | [fs.h#L1926-L1970](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/fs.h#L1926-L1970) | source-code | `struct file_operations` — function-pointer table (`.read`, `.read_iter`, `.open`…) dispatched per file type |
| Bitmask | [stat.h#L25-L41](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/uapi/linux/stat.h#L25-L41) | source-code | Permission bits (`S_IRWXU`/`S_IRUSR`…) packed into one integer; checks are `mode & flag` |
| Reference counting | [kobject.c#L636-L644](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/lib/kobject.c#L636-L644) | source-code | `kobject_get` bumps the `kref`; the object is freed only when the count hits zero |
| Composition (by design) | [VFS documentation](https://www.kernel.org/doc/html/latest/filesystems/vfs.html) | official-doc | The kernel's own explanation of how `file_operations` makes "everything is a file" work |

## Takeaways

- **Patterns rarely ship alone.** Reading a file needs a *dispatch* pattern
  (vtable), an *access-control* pattern (bitmask), and a *lifetime* pattern
  (reference counting) at once — and they hand off in order.
- **A vtable is polymorphism in C.** Where C++ has virtual methods, the kernel
  hand-rolls a struct of function pointers. Recognising "struct of function
  pointers" as a vtable unlocks how most C subsystems do dispatch.
- **Reference counting is what makes sharing safe.** "Delete an open file"
  working correctly is not magic — it is one counter that defers free until the
  last holder leaves.
- **This echoes Go's runtime.** Both use a function-pointer/interface table to
  abstract over many implementations; reading the hot path of one makes the
  other easier to recognise.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the abstraction** — the kernel's
   [VFS documentation](https://www.kernel.org/doc/html/latest/filesystems/vfs.html)
   explains why `file_operations` exists and how "everything is a file" works.
   Read this first; the source then confirms it.
2. **Then read the source, in this order** — the dispatch table
   ([file_operations](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/linux/fs.h#L1926-L1970))
   → the permission bits it gates on
   ([mode bits](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/include/uapi/linux/stat.h#L25-L41))
   → the counter that keeps it alive
   ([kobject_get](https://github.com/torvalds/linux/blob/acb7500801e98639f6d8c2d796ed9f64cba83d3a/lib/kobject.c#L636-L644)).
3. **Experiment locally** — run `stat -c '%a %A' somefile` to see the same mode
   as octal *and* `rwx` letters, then `ls -l /proc/self/fd` to watch reference
   counts keep deleted-but-open files alive.
4. **Compare across systems** — read the [Go scheduler case study](/case-studies/go-scheduler)
   and note how Go's interface dispatch plays the same role as the kernel's
   vtable. Same pattern, different language.
5. **Practise the recognition** — open the three pattern pages below and look for
   "struct of function pointers", "flags packed in an int", and "free on last
   release" in another system you know.
6. **Read the reference-count primer** — the kernel's official
   [kref documentation](https://www.kernel.org/doc/html/latest/core-api/kref.html)
   explains the get/put discipline and the classic pitfalls, complementing the
   `f_count` note above.

## Study These Patterns

- [Vtable](/patterns/vtable/) — function-pointer table for polymorphic dispatch
- [Bitmask](/patterns/bitmask/) — pack many flags into one integer
- [Reference Counting](/patterns/reference-counting/) — free only on the last release
