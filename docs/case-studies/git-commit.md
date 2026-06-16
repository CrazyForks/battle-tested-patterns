---
title: 'Case Study: How Git Composes Three Patterns in a Commit'
description: A deep dive into how Git's commit machinery combines content-addressed copy-on-write objects, a Merkle DAG, and Myers diff — every claim backed by source code at a pinned commit.
---

# Case Study: How Git Composes Three Patterns in a Commit

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — Git's object store
> — composes **three** patterns so that a commit is simultaneously
> space-efficient, tamper-evident, and cheap to compare. Every per-pattern claim
> links to source code at a pinned commit; the composition argument is backed by
> Git's own documentation.

## The Problem Git Solves

A version control system has to store the entire history of a project and let
you move between any two points in it instantly. Naively, that means keeping a
full copy of every file at every revision — which would explode on disk — or
storing deltas in a chain so long that checking out an old version becomes slow.
Git also has a second, harder requirement: history must be **tamper-evident**.
If a single byte of any past file silently changes, Git must be able to tell.

Git's answer is an object store where content is **addressed by its own hash**.
Achieving "small on disk + provably unchanged + fast to diff" at once requires
three patterns working together. None is novel alone — what is instructive is
*how they compose*.

| Question | Pattern | How Git answers it |
|----------|---------|--------------------|
| *How do we avoid copying unchanged data?* | **Copy-on-write** | Content-addressed objects; identical content is stored once and shared |
| *How do we prove nothing was tampered with?* | **Merkle tree** | Each object's name is the hash of its content, including child hashes |
| *How do we show what changed between versions?* | **Diff / patch** | Myers diff computes a minimal edit script on demand |

## Pattern 1 — Copy-on-write: content-addressed objects

Git never stores a file under its path. It stores the file's *content* under the
**hash of that content**. The function that turns bytes into a name is
`hash_object_file`:

```c
void hash_object_file(const struct git_hash_algo *algo, const void *buf,
                      unsigned long len, enum object_type type,
                      struct object_id *oid)
{
  char hdr[MAX_HEADER_LEN];
  int hdrlen = sizeof(hdr);
  write_object_file_prepare(algo, buf, len, type, oid, hdr, &hdrlen);
}
```

The `oid` (object id) it produces *is* the storage key. This gives
copy-on-write for free: if two commits contain the same file, both reference the
same object id, so the bytes are stored **once**. A new commit only writes
objects whose content actually changed; everything else is shared by reference.

::: tip Mental model
Think of the object store as a content-keyed hash map: `oid → bytes`. "Editing"
a file never mutates an object — it creates a *new* object with a *new* name and
leaves the old one untouched. Old commits keep pointing at the old name, so they
are unaffected. That immutability is exactly what copy-on-write means.
:::

→ For the pattern in isolation, see [Copy-on-Write](/patterns/copy-on-write/).

## Pattern 2 — Merkle tree: hashing that bubbles up

Content-addressing one file is easy. The clever part is how Git names a
*directory*. A tree object lists its entries — each entry being a mode, a name,
and the **object id of its child** — and then hashes that list. The child's hash
is part of the parent's content, so the parent's hash depends on it:

```c
strbuf_addf(&buffer, "%o %.*s%c", mode, entlen, path + baselen, '\0');
strbuf_add(&buffer, oid->hash, the_hash_algo->rawsz);   // ← child hash goes in
/* ...for every entry... */
hash_object_file(the_hash_algo, buffer.buf, buffer.len, OBJ_TREE, &it->oid);
```

This is a **Merkle DAG**: change one byte in one file, and its object id
changes; that new id changes the hash of the tree containing it; which changes
the hash of every tree above it, up to the commit. A commit hash therefore
fingerprints the *entire* tree of content reachable from it.

::: tip Mental model
The Merkle property turns integrity into a single comparison. To check whether
two huge directory trees are identical, you do **not** walk them — you compare
their top-level hashes. Equal hash ⇒ identical content, all the way down. This
is also why you cannot quietly alter old history: doing so would change a hash
that everything downstream commits to.
:::

→ For the pattern in isolation, see [Merkle Tree](/patterns/merkle-tree/).

## Pattern 3 — Diff / patch: computing change on demand

Because objects are immutable and content-addressed, Git does **not** store
"what changed" — it stores whole snapshots and *computes* the difference when
you ask (`git diff`, `git log -p`, rename detection). `run_diff` is the entry
point that produces the edit script between two blobs:

```c
static void run_diff(struct diff_filepair *p, struct diff_options *o)
{
  struct diff_filespec *one = p->one;   // old version
  struct diff_filespec *two = p->two;   // new version
  /* ...resolve paths, fill oid info, then run the diff algorithm... */
  diff_fill_oid_info(one, o->repo->index);
}
```

Under the hood this runs a Myers-style minimal-edit-distance diff (in `xdiff/`),
turning "snapshot A" and "snapshot B" into the smallest set of line
insertions/deletions that explains the change.

::: tip Mental model
Snapshots are the source of truth; diffs are a *view* computed from them. This
inverts the naive design (store diffs, reconstruct snapshots): Git stores
snapshots cheaply via sharing, and pays the diff cost only when a human actually
wants to see a change.
:::

→ For the pattern in isolation, see [Diff / Patch](/patterns/diff-patch/).

## How the Three Compose

Run `git commit` and the three patterns hand off in order:

1. **Diff / patch** is what you *looked at* to decide what to stage — but it is a
   view, not storage. The commit itself stores snapshots.
2. **Copy-on-write** writes a new object only for content that changed; every
   unchanged blob and subtree is reused by its existing object id.
3. **Merkle tree** hashes the new tree(s) bottom-up — each parent's hash folds in
   its children's hashes — producing one commit hash that fingerprints the whole
   snapshot.

```text
edit files
    │  (diff/patch: a *view* of what changed — not stored)
    ▼
write changed blobs only ───► content-addressed objects (copy-on-write)
    │                             identical content shared by oid
    ▼
build tree objects bottom-up
    │  each entry embeds child oid.hash, then hash_object_file(OBJ_TREE)
    ▼
commit hash = fingerprint of the entire reachable tree (Merkle DAG)
```

The result: a commit is **cheap** (only changed objects are written),
**verifiable** (one hash covers everything reachable), and **diffable** (any two
commits can be compared on demand). Remove any one pattern and it breaks:
without content-addressing there is no sharing and no stable name; without the
Merkle structure a hash could not cover a whole tree, so tampering would go
undetected; without on-demand diff, Git would have to choose between storing
bulky snapshots *and* bulky deltas.

::: info Architectural inference
The framing of these three as a *deliberately composed* design rests on Git's
own documentation of its object model (see the evidence table and Further
Reading), not on any single source file. The per-pattern code links are direct
source-code evidence; the "combined by design" claim is supported by that
design-level material.
:::

## Production Proof

All source links are pinned to Git commit
`1ff279f3404a482a83fb04c7457e41ab26884aea`. Per-pattern claims are
`source-code` (L1); the composition relationship is backed by official
documentation (`official-doc`).

| Pattern / Claim | Source | Evidence | Role in `git commit` |
|-----------------|--------|----------|----------------------|
| Copy-on-write | [object-file.c#L719-L730](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/object-file.c#L719-L730) | source-code | `hash_object_file` names content by its hash → identical content stored once |
| Merkle tree | [cache-tree.c#L435-L458](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/cache-tree.c#L435-L458) | source-code | Each tree entry embeds its child's `oid->hash`, then the tree itself is hashed |
| Diff / patch | [diff.c#L5020-L5060](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/diff.c#L5020-L5060) | source-code | `run_diff` computes the edit script between two blob versions on demand |
| Composition (by design) | [Pro Git — Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) | official-doc | Official explanation of the content-addressed object model commits are built on |

## Takeaways

- **Patterns rarely ship alone.** A version control object store needs a
  *storage* pattern (copy-on-write), an *integrity* pattern (Merkle tree), and a
  *comparison* pattern (diff/patch) at once — and they hand off in order.
- **Store snapshots, compute diffs.** Git inverts the naive "store the deltas"
  design: immutability + sharing makes snapshots cheap, and diffs become a view
  produced only when needed.
- **Hashing content is what unifies them.** Content-addressing is simultaneously
  the sharing key (copy-on-write) and the integrity fingerprint (Merkle) — one
  primitive doing two jobs, just like bitmask in the React Fiber study.
- **Follow the data, not the command.** `git commit` reads as one action, but
  tracing what it *writes* reveals three patterns interlocking.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the object model** — [Pro Git: Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)
   explains blobs, trees, and commits as content-addressed objects. Read this
   first; everything else confirms it.
2. **Then read the source, in this order** — content hashing
   ([object-file.c](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/object-file.c#L719-L730))
   → how trees fold child hashes upward
   ([cache-tree.c](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/cache-tree.c#L435-L458))
   → diff on demand
   ([diff.c](https://github.com/git/git/blob/1ff279f3404a482a83fb04c7457e41ab26884aea/diff.c#L5020-L5060)).
3. **Experiment locally** — run `git cat-file -p HEAD^{tree}` to see a real tree
   object's entries, then `git hash-object` a file and watch the same name come
   back for identical content. Seeing the hash stay stable makes copy-on-write
   and the Merkle property concrete.
4. **Practise the recognition** — open the three pattern pages below; then look
   for the same three roles (storage / integrity / comparison) in another system
   you know, such as a content-addressed cache or a blockchain.

## Study These Patterns

- [Copy-on-Write](/patterns/copy-on-write/) — share until a write forces a copy
- [Merkle Tree](/patterns/merkle-tree/) — hashing that makes tampering detectable
- [Diff / Patch](/patterns/diff-patch/) — minimal edit script between versions
