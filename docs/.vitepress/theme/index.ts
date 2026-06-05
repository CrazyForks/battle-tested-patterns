import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import { defineAsyncComponent, defineComponent, h } from 'vue';
import VizSkeleton from './components/VizSkeleton.vue';
import DemoBadge from './components/DemoBadge.vue';
import DifficultyBadge from './components/DifficultyBadge.vue';
import CompositionFlow from './components/CompositionFlow.vue';
import './custom.css';

const vizComponents: Record<string, () => Promise<any>> = {
  RingBufferViz: () => import('./components/RingBufferViz.vue'),
  LRUCacheViz: () => import('./components/LRUCacheViz.vue'),
  BloomFilterViz: () => import('./components/BloomFilterViz.vue'),
  CircuitBreakerViz: () => import('./components/CircuitBreakerViz.vue'),
  ConsistentHashViz: () => import('./components/ConsistentHashViz.vue'),
  MinHeapViz: () => import('./components/MinHeapViz.vue'),
  SkipListViz: () => import('./components/SkipListViz.vue'),
  TrieViz: () => import('./components/TrieViz.vue'),
  StateMachineViz: () => import('./components/StateMachineViz.vue'),
  EventLoopViz: () => import('./components/EventLoopViz.vue'),
  RateLimiterViz: () => import('./components/RateLimiterViz.vue'),
  MerkleTreeViz: () => import('./components/MerkleTreeViz.vue'),
  BPlusTreeViz: () => import('./components/BPlusTreeViz.vue'),
  DependencyGraphViz: () => import('./components/DependencyGraphViz.vue'),
  ObserverViz: () => import('./components/ObserverViz.vue'),
  BackpressureViz: () => import('./components/BackpressureViz.vue'),
  CopyOnWriteViz: () => import('./components/CopyOnWriteViz.vue'),
  SemaphoreViz: () => import('./components/SemaphoreViz.vue'),
  RetryBackoffViz: () => import('./components/RetryBackoffViz.vue'),
  DoubleBufferingViz: () => import('./components/DoubleBufferingViz.vue'),
  FlyweightViz: () => import('./components/FlyweightViz.vue'),
  ObjectPoolViz: () => import('./components/ObjectPoolViz.vue'),
  BitmaskViz: () => import('./components/BitmaskViz.vue'),
  MiddlewareChainViz: () => import('./components/MiddlewareChainViz.vue'),
  WorkStealingViz: () => import('./components/WorkStealingViz.vue'),
  WriteAheadLogViz: () => import('./components/WriteAheadLogViz.vue'),
  DirtyFlagViz: () => import('./components/DirtyFlagViz.vue'),
  LogicalClockViz: () => import('./components/LogicalClockViz.vue'),
  ReferenceCountingViz: () => import('./components/ReferenceCountingViz.vue'),
  ActorModelViz: () => import('./components/ActorModelViz.vue'),
  ArenaAllocatorViz: () => import('./components/ArenaAllocatorViz.vue'),
  BatchProcessingViz: () => import('./components/BatchProcessingViz.vue'),
  CheckpointingViz: () => import('./components/CheckpointingViz.vue'),
  CooperativeSchedulingViz: () => import('./components/CooperativeSchedulingViz.vue'),
  DiffPatchViz: () => import('./components/DiffPatchViz.vue'),
  FreeListViz: () => import('./components/FreeListViz.vue'),
  InterningViz: () => import('./components/InterningViz.vue'),
  MergeIteratorViz: () => import('./components/MergeIteratorViz.vue'),
  MVCCViz: () => import('./components/MVCCViz.vue'),
  VisitorViz: () => import('./components/VisitorViz.vue'),
  VTableViz: () => import('./components/VTableViz.vue'),
  IteratorViz: () => import('./components/IteratorViz.vue'),
  LSMTreeViz: () => import('./components/LSMTreeViz.vue'),
  RegistryViz: () => import('./components/RegistryViz.vue'),
  TaggedUnionViz: () => import('./components/TaggedUnionViz.vue'),
  TombstoneViz: () => import('./components/TombstoneViz.vue'),
  PatternTimelineViz: () => import('./components/PatternTimelineViz.vue'),
  PatternConnectionsViz: () => import('./components/PatternConnectionsViz.vue'),
};

function clientOnly(loader: () => Promise<any>) {
  const AsyncComp = defineAsyncComponent({
    loader,
    loadingComponent: VizSkeleton,
    delay: 0,
  });
  return defineComponent({
    setup() {
      return () =>
        typeof window === 'undefined' ? null : h(AsyncComp);
    },
  });
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DemoBadge', DemoBadge);
    app.component('DifficultyBadge', DifficultyBadge);
    app.component('CompositionFlow', CompositionFlow);
    for (const [name, loader] of Object.entries(vizComponents)) {
      app.component(name, clientOnly(loader));
    }
  },
} satisfies Theme;
