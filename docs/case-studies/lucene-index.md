---
title: 'Case Study: How Lucene Composes Three Patterns for Fast Full-Text Search'
description: A deep dive into how Apache Lucene combines a multi-level skip list, a merge iterator, and an optional Bloom filter so term lookups skip ahead, segment merges stay streaming, and missing terms are rejected in O(1) — every claim backed by source code at a pinned commit.
---

# Case Study: How Lucene Composes Three Patterns for Fast Full-Text Search

> **What this is.** Most pattern docs teach one pattern in isolation. This case
> study does the opposite: it dissects how one real system — Apache Lucene, the
> search library under Elasticsearch and Solr — composes **three** patterns so
> that scanning a long postings list skips ahead instead of walking it, merging
> many immutable segments stays a streaming merge, and a term that isn't present
> is rejected without touching the dictionary. Every per-pattern claim links to
> source code at a pinned commit; the composition argument is backed by Lucene's
> own architecture documentation.

## The Problem Lucene Solves

Full-text search inverts the data: instead of "document → its words", Lucene keeps
a *postings list* per term — "word → every document that contains it". Querying
`cat AND dog` means intersecting the postings list of `cat` with that of `dog`.
Three difficulties follow:

- **Postings lists are long.** A common term appears in millions of documents.
  Walking the list one doc id at a time to find a match is far too slow.
- **The index is many immutable segments.** Lucene never edits an index in place;
  it writes new immutable *segments* and merges them in the background. A term's
  full postings must be assembled by merging its per-segment lists in doc-id order.
- **Most segments don't contain most terms.** A lookup that consults a segment's
  term dictionary only to find the term absent is wasted work, repeated across
  every segment.

Three patterns answer these in turn — and the third is an *optional* component you
opt into when the workload warrants it.

| Question | Pattern | How Lucene answers it |
|----------|---------|-----------------------|
| *How do we jump ahead in a long postings list?* | **Skip list** | A multi-level skip list over the postings lets `advance(target)` jump in `O(log n)` instead of scanning |
| *How do we read one term across many segments in order?* | **Merge iterator** | A priority-queue-driven merge yields doc ids from all segments' postings in global order |
| *How do we reject an absent term without a dictionary lookup?* | **Bloom filter** | An optional per-segment Bloom filter answers "definitely not here" in `O(1)` |

## Pattern 1 — Skip list: jump ahead instead of scanning

A query like `cat AND dog` repeatedly asks the `cat` postings list "give me your
first doc id ≥ this one I just got from `dog`". Answering that by scanning forward
one doc at a time is `O(n)`. Lucene instead builds a **multi-level skip list** over
each postings list, so `advance`/`skipTo` can leap. `MultiLevelSkipListReader.skipTo`
is the core:

```java
public int skipTo(int target) throws IOException {
  // walk up the levels until highest level is found that has a skip for this target
  int level = 0;
  while (level < numberOfSkipLevels - 1 && target > skipDoc[level + 1]) {
    level++;
  }
  while (level >= 0) {
    if (target > skipDoc[level]) {
      if (!loadNextSkip(level)) continue;
    } else {
      // go down one level
      if (level > 0 && lastChildPointer > skipStream[level - 1].getFilePointer()) {
        seekChild(level - 1);
      }
      level--;
    }
  }
  return numSkipped[0] - skipInterval[0] - 1;
}
```

The structure is a tower of linked lists: the top level skips over huge spans, each
lower level over smaller ones. `skipTo(target)` climbs to the highest level whose
next skip still overshoots `target`, then descends, taking the largest jumps that
don't overshoot at each level. The effect is the classic skip-list `O(log n)`
search — the same structure Redis uses for sorted sets, here applied to doc-id
postings.

::: tip Mental model
A skip list is an express-train map laid over a local line. The top track stops
only at major stations (big jumps); lower tracks stop more often. To reach a
station you ride the fastest line that doesn't overshoot, then transfer down. The
postings list is the local line; the skip levels are the expresses.
:::

→ For the pattern in isolation, see [Skip List](/patterns/skip-list/).

## Pattern 2 — Merge iterator: read one term across many segments in order

Because Lucene writes immutable segments and merges them lazily, a term's complete
postings are spread across several segments. To merge segments — or to read a term
across them — Lucene must produce doc ids from all of them in a single ascending
stream. `MappingMultiPostingsEnum.nextDoc` is the merge iterator over per-segment
postings:

```java
public int nextDoc() throws IOException {
  current = docIDMerger.next();
  if (current == null) {
    return NO_MORE_DOCS;
  } else {
    return current.mappedDocID;
  }
}
```

The `docIDMerger` is a priority queue keyed on doc id: each call to `next()` pops
the sub-iterator currently at the smallest doc id, advances it, and re-heaps. The
result is a single iterator that streams the merged postings in global doc-id order
without materialising them all in memory — the textbook **k-way merge**. The
`mappedDocID` step renumbers ids into the merged segment's address space.

::: tip Mental model
Merging segments is like interleaving several already-sorted card piles into one
sorted pile. You repeatedly take the smallest card showing on top of any pile and
place it down, then flip the next card on that pile. A priority queue tracks "which
pile shows the smallest card" so each step is cheap. You never need all cards in
hand at once.
:::

→ For the pattern in isolation, see [Merge Iterator](/patterns/merge-iterator/).

## Pattern 3 — Bloom filter: reject absent terms in O(1)

Looking up a term means consulting a segment's term dictionary. If the term isn't
in that segment, the lookup was wasted — and across many segments and many queried
terms, that waste adds up. Lucene offers an **optional** `BloomFilteringPostingsFormat`
(in the `lucene-codecs` module, not the default codec) that keeps a per-field Bloom
filter so a definitely-absent term is rejected before any dictionary work.
`FuzzySet.contains` is the test:

```java
public ContainsResult contains(BytesRef value) {
  long hash = hashFunction.hash(value);
  int msb = (int) (hash >>> Integer.SIZE);
  int lsb = (int) hash;
  for (int i = 0; i < hashCount; i++) {
    int bloomPos = (lsb + i * msb);     // k hashes via one hash + delta rotation
    if (!mayContainValue(bloomPos)) {
      return ContainsResult.NO;         // definitely not present — skip the dictionary
    }
  }
  return ContainsResult.MAYBE;          // possibly present — go check the dictionary
}
```

Note the `lsb + i * msb` trick: rather than computing `hashCount` independent hash
functions, Lucene derives all `k` bit positions from a single 64-bit hash split
into two halves — the same double-hashing shortcut LevelDB uses. The contract is
asymmetric: `NO` is certain (skip the dictionary entirely), `MAYBE` means "do the
real lookup". Being optional, it is a pure speed/space trade you enable only when
many queries probe terms that are absent from most segments.

::: tip Mental model
The Bloom filter is a bouncer with a guest list compressed into a few bits. Ask
"is `xyzzy` inside?" and a `NO` is final — don't bother opening the door (the
dictionary). A `MAYBE` just means "check the actual list". The bouncer can never
wrongly turn away a real guest (no false negatives), only occasionally wave through
a non-guest (false positive).
:::

→ For the pattern in isolation, see [Bloom Filter](/patterns/bloom-filter/).

## How the Three Compose

Run a multi-term query against an index of many segments and the three patterns
hand off:

1. **Bloom filter** (`FuzzySet.contains`), when enabled, fronts each segment's term
   lookup: a `NO` skips that segment's dictionary entirely for that term.
2. **Skip list** (`MultiLevelSkipListReader.skipTo`) accelerates the postings scan
   within a segment: `advance(target)` leaps ahead in `O(log n)` instead of walking
   doc by doc — this is what makes `AND` intersection fast.
3. **Merge iterator** (`MappingMultiPostingsEnum.nextDoc`) streams a term's postings
   across all segments in global doc-id order — both at query time and during the
   background segment merges that keep the index healthy.

```text
query: cat AND dog   (index = many immutable segments)
        │
        │  (bloom: FuzzySet.contains → NO ⇒ skip this segment's dictionary for the term)
        ▼
   per-segment term lookup (only where MAYBE)
        │  (skip list: skipTo(target) leaps ahead in the postings — O(log n) advance)
        ▼
   per-segment postings iterators
        │  (merge iterator: docIDMerger.next() yields doc ids in global order)
        ▼
   single ascending doc-id stream  ──►  intersect for AND, score, return
```

The unifying idea is **make every scan skip the work it can prove is unnecessary**.
The Bloom filter skips whole segments that can't hold the term; the skip list skips
spans of a postings list that can't hold the target; the merge iterator avoids
materialising all postings by streaming the minimum at each step. Remove any one
and it degrades: without the skip list, intersection walks every posting; without
the merge iterator, multi-segment reads buffer everything; without the (optional)
Bloom filter, every absent-term probe pays a dictionary lookup.

::: info Architectural inference
The framing of these three as a *deliberately composed* design — skip-accelerated
postings, streaming segment merges, and optional Bloom-filtered term lookups —
rests on Lucene's codec/segment architecture documentation and core-committer
writing (see Further Reading), not on any single source file. The per-pattern code
links are direct source-code evidence; the "combined by design" claim is supported
by that design-level material. The Bloom filter is explicitly an *optional* codec,
not part of the default index.
:::

## Production Proof

All source links are pinned to Apache Lucene commit
`e913796758de3d9b9440669384b29bec07e6a5cd` (release 9.12.0). Per-pattern claims are
`source-code` (L1); the composition relationship is backed by official
documentation (`official-doc`) and core-committer writing (`official-blog`).

| Pattern / Claim | Source | Evidence | Role in a query / merge |
|-----------------|--------|----------|-------------------------|
| Skip list | [MultiLevelSkipListReader.java#L112-L135](https://github.com/apache/lucene/blob/e913796758de3d9b9440669384b29bec07e6a5cd/lucene/core/src/java/org/apache/lucene/codecs/MultiLevelSkipListReader.java#L112-L135) | source-code | `skipTo` leaps over a postings list in `O(log n)` via a multi-level skip structure |
| Merge iterator | [MappingMultiPostingsEnum.java#L99-L107](https://github.com/apache/lucene/blob/e913796758de3d9b9440669384b29bec07e6a5cd/lucene/core/src/java/org/apache/lucene/index/MappingMultiPostingsEnum.java#L99-L107) | source-code | `nextDoc` pops the smallest doc id from a priority-queue merge of per-segment postings |
| Bloom filter (optional) | [FuzzySet.java#L152-L163](https://github.com/apache/lucene/blob/e913796758de3d9b9440669384b29bec07e6a5cd/lucene/codecs/src/java/org/apache/lucene/codecs/bloom/FuzzySet.java#L152-L163) | source-code | `contains` returns `NO`/`MAYBE` so an absent term skips the dictionary; an opt-in `BloomFilteringPostingsFormat` |
| Composition (by design) | [Lucene codecs package documentation](https://lucene.apache.org/core/9_12_0/core/org/apache/lucene/codecs/package-summary.html) | official-doc | Lucene's own description of the codec/postings/segment architecture these patterns serve |
| Composition (by design) | [Changing Bits (Michael McCandless)](https://blog.mikemccandless.com/) | official-blog | A core Lucene committer's writing on segment merging and skip lists |

## Takeaways

- **Patterns rarely ship alone.** Fast search needs a *jump* pattern (skip list), a
  *streaming-merge* pattern (merge iterator), and an *avoid-the-lookup* pattern
  (Bloom filter) at once — and they hand off across the query path.
- **Every layer skips provable-unnecessary work.** Bloom skips whole segments, the
  skip list skips spans of a postings list, the merge iterator skips materialising
  everything. The composition is "prove it's not needed, then don't do it", three
  times over.
- **Optional means optional — say so.** Lucene's Bloom filter is a codec you opt
  into; describing it as always-on would mislead. Honest scoping is part of the
  claim.
- **This echoes LevelDB and Kafka.** The merge iterator is the same k-way merge that
  drives LSM compaction; the Bloom filter uses LevelDB's exact double-hashing trick.
  Reading one makes the others' read path easier to recognise.

## Further Reading

A path from "I read this" to "I can recognise these patterns anywhere":

1. **Start with the codec architecture** — Lucene's
   [codecs package documentation](https://lucene.apache.org/core/9_12_0/core/org/apache/lucene/codecs/package-summary.html)
   explains postings formats, the segment model, and where skip data and Bloom
   filters fit. Read this first; the source then confirms it.
2. **Then a committer's perspective** — [Changing Bits](https://blog.mikemccandless.com/),
   Michael McCandless's blog, covers segment merging and skip lists from the inside.
3. **Then browse the API** — the [Lucene 9.12.0 Javadoc](https://lucene.apache.org/core/9_12_0/index.html)
   lets you trace `advance`, `PostingsEnum`, and the codec interfaces.
4. **Compare across systems** — read the [LevelDB LSM case study](/case-studies/leveldb-lsm)
   and note how the same k-way merge and Bloom double-hashing appear in a key-value
   store. Same patterns, different domain.

## Study These Patterns

- [Skip List](/patterns/skip-list/) — probabilistic multi-level lists for `O(log n)` search and skip
- [Merge Iterator](/patterns/merge-iterator/) — stream k sorted inputs into one ordered output via a heap
- [Bloom Filter](/patterns/bloom-filter/) — a tiny bit array that answers "definitely not present" in `O(1)`
