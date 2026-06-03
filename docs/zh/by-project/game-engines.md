# 游戏引擎中的模式

| 模式 | 项目 | 位置 | 作用 |
|------|------|------|------|
| [对象池](/zh/patterns/object-pool/) | Godot | [`pooled_list.h`](https://github.com/godotengine/godot/blob/master/core/templates/pooled_list.h#L35-L100) | 基于 freelist 的游戏对象池 |
| [双缓冲](/zh/patterns/double-buffering/) | SDL | [`SDL_render.c`](https://github.com/libsdl-org/SDL/blob/main/src/render/SDL_render.c#L5535-L5570) | 前后 buffer 交换实现无撕裂渲染 |
| [空闲链表](/zh/patterns/free-list/) | Godot | [`pooled_list.h`](https://github.com/godotengine/godot/blob/master/core/templates/pooled_list.h#L35-L100) | 非侵入式空闲链表，O(1) 实体分配/释放 |
| [环形缓冲区](/zh/patterns/ring-buffer/) | 游戏音频 | 各引擎通用 | 主线程和音频线程间的无锁音频流缓冲 |
| [状态机](/zh/patterns/state-machine/) | Godot | [`animation_tree.h`](https://github.com/godotengine/godot/blob/master/scene/animation/animation_tree.h) | 角色动画混合的动画状态机 |
| [Arena 分配器](/zh/patterns/arena-allocator/) | 帧分配器 | 通用模式 | 每帧 bump 分配器——每帧重置，零释放开销 |
| [享元](/zh/patterns/flyweight/) | Godot | [`servers/rendering/`](https://github.com/godotengine/godot/tree/master/servers/rendering) | 多个实例共享的网格/纹理资源 |
| [批处理](/zh/patterns/batch-processing/) | Godot / Unity | 渲染批处理 | 批量 draw call 减少 GPU 状态切换 |
| [标签联合](/zh/patterns/tagged-union/) | Godot | [`variant.h`](https://github.com/godotengine/godot/blob/master/core/variant/variant.h#L78-L120) | `Variant::Type` 枚举 + 联合体——GDScript 中每个值都是 `Variant` |
| [脏标记](/zh/patterns/dirty-flag/) | Godot / Unity | 变换层级 | 父变换脏标记使子节点世界矩阵失效——仅在访问时重算 |
| [事件循环](/zh/patterns/event-loop/) | Godot | [`main_loop.h`](https://github.com/godotengine/godot/blob/master/core/os/main_loop.h) | 主游戏循环——按固定步长处理输入、更新、渲染 |
