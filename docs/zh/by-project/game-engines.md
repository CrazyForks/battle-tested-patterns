# 游戏引擎中的模式

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [对象池](/zh/patterns/object-pool/) | Godot | `pooled_list.h` | 基于 freelist 的游戏对象池 |
| [双缓冲](/zh/patterns/double-buffering/) | SDL | `SDL_render.c` | 前后 buffer 交换实现无撕裂渲染 |
| [空闲链表](/zh/patterns/free-list/) | Godot | `pooled_list.h` | 非侵入式空闲链表，O(1) 实体分配/释放 |
| [环形缓冲区](/zh/patterns/ring-buffer/) | 游戏音频 | 各引擎通用 | 主线程和音频线程间的无锁音频流缓冲 |
| [状态机](/zh/patterns/state-machine/) | Godot | `animation_tree.h` | 角色动画混合的动画状态机 |
| [Arena 分配器](/zh/patterns/arena-allocator/) | 帧分配器 | 通用模式 | 每帧 bump 分配器——每帧重置，零释放开销 |
| [享元](/zh/patterns/flyweight/) | Godot | `servers/rendering/` | 多个实例共享的网格/纹理资源 |
| [批处理](/zh/patterns/batch-processing/) | Godot / Unity | 渲染批处理 | 批量 draw call 减少 GPU 状态切换 |
