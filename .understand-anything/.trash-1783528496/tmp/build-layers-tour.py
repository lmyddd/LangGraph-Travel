#!/usr/bin/env python3
"""Generate architecture layers, tour, and assemble final knowledge graph."""
import json
import os
from datetime import datetime, timezone

with open('.understand-anything/intermediate/assembled-graph.json', 'r', encoding='utf-8') as f:
    g = json.load(f)

nodes = g['nodes']
edges = g['edges']

# Build node lookup
node_by_id = {n['id']: n for n in nodes}
node_by_path = {}
for n in nodes:
    fp = n.get('filePath', '')
    if fp:
        node_by_path[fp] = n['id']

# ── Phase 4: Architecture Layers ──

layers = [
    {
        "id": "layer:documentation",
        "name": "文档层",
        "description": "项目文档：README 项目说明、面试准备资料、学习指南",
        "nodeIds": [
            "document:README.md",
            "document:JD面试准备-针对性问答.md",
            "document:面试学习指南.md",
            "document:travel-h5/README.md",
        ]
    },
    {
        "id": "layer:shared-types",
        "name": "共享类型层",
        "description": "前后端共享 TypeScript 类型定义，确保 API 契约一致",
        "nodeIds": [
            "file:shared/types.ts",
        ]
    },
    {
        "id": "layer:frontend-entry-config",
        "name": "前端入口与配置",
        "description": "Vue 应用入口、全局配置、构建工具链",
        "nodeIds": [
            "file:travel-h5/src/main.ts",
            "file:travel-h5/src/App.vue",
            "file:travel-h5/index.html",
            "config:travel-h5/package.json",
            "config:travel-h5/tsconfig.json",
            "config:travel-h5/vite.config.ts",
            "file:travel-h5/src/env.d.ts",
            "file:travel-h5/components.d.ts",
            "config:travel-h5/.gitignore",
        ]
    },
    {
        "id": "layer:frontend-routing",
        "name": "前端路由层",
        "description": "Vue Router 配置：7 条懒加载路由、路由守卫、JWT 拦截",
        "nodeIds": [
            "file:travel-h5/src/router/index.ts",
        ]
    },
    {
        "id": "layer:frontend-pages",
        "name": "页面层",
        "description": "7 个移动端页面：首页推荐、AI 对话、行程生成、历史记录、行程详情、登录注册、个人中心",
        "nodeIds": [
            "file:travel-h5/src/views/home/index.vue",
            "file:travel-h5/src/views/chat/index.vue",
            "file:travel-h5/src/views/detail/index.vue",
            "file:travel-h5/src/views/history/index.vue",
            "file:travel-h5/src/views/trip-detail/index.vue",
            "file:travel-h5/src/views/login/index.vue",
            "file:travel-h5/src/views/profile/index.vue",
        ]
    },
    {
        "id": "layer:frontend-components",
        "name": "组件层",
        "description": "可复用 UI 组件：聊天气泡、Agent 步骤指示器、城市卡片、景点卡片、预算图表、统计卡片、骨架屏、页面过渡",
        "nodeIds": [
            "file:travel-h5/src/components/ChatBubble.vue",
            "file:travel-h5/src/components/AgentPipeline.vue",
            "file:travel-h5/src/components/CityCard.vue",
            "file:travel-h5/src/components/SpotItem.vue",
            "file:travel-h5/src/components/BudgetTable.vue",
            "file:travel-h5/src/components/StatCard.vue",
            "file:travel-h5/src/components/SkeletonCard.vue",
            "file:travel-h5/src/components/PageTransition.vue",
        ]
    },
    {
        "id": "layer:frontend-logic",
        "name": "前端逻辑层",
        "description": "Composable 函数（SSE 流管理、Markdown 渲染、追问建议、剪贴板、密码强度）+ Pinia 状态管理 + HTTP 客户端 + 工具函数",
        "nodeIds": [
            "file:travel-h5/src/composables/useAgentStream.ts",
            "file:travel-h5/src/composables/useMarkdown.ts",
            "file:travel-h5/src/composables/useSuggestedQuestions.ts",
            "file:travel-h5/src/composables/useClipboard.ts",
            "file:travel-h5/src/composables/usePasswordStrength.ts",
            "file:travel-h5/src/store/user.ts",
            "file:travel-h5/src/store/favorites.ts",
            "file:travel-h5/src/utils/request.ts",
            "file:travel-h5/src/utils/cities.ts",
        ]
    },
    {
        "id": "layer:frontend-style",
        "name": "样式层",
        "description": "全局 CSS 样式和设计变量",
        "nodeIds": [
            "file:travel-h5/src/style/common.css",
        ]
    },
    {
        "id": "layer:server-entry-config",
        "name": "后端入口与配置",
        "description": "Express 服务入口、环境变量、编译和运行配置",
        "nodeIds": [
            "file:travel-server/src/index.ts",
            "config:travel-server/package.json",
            "config:travel-server/tsconfig.json",
            "config:travel-server/nodemon.json",
            "config:travel-server/.env",
            "config:travel-server/.env.example",
            "config:travel-server/.gitignore",
            "config:travel-server/prisma.config.ts",
        ]
    },
    {
        "id": "layer:api-routes",
        "name": "API 路由层",
        "description": "RESTful API 端点：认证、旅行规划、行程管理",
        "nodeIds": [
            "file:travel-server/src/routes/auth.ts",
            "file:travel-server/src/routes/travel.ts",
            "file:travel-server/src/routes/trip.ts",
        ]
    },
    {
        "id": "layer:middleware",
        "name": "中间件层",
        "description": "JWT 认证中间件：Token 验证、用户身份提取",
        "nodeIds": [
            "file:travel-server/src/middleware/auth.ts",
        ]
    },
    {
        "id": "layer:service-layer",
        "name": "服务层",
        "description": "业务逻辑服务：用户管理、行程编排、对话记录、行程 CRUD、Prisma 数据库连接",
        "nodeIds": [
            "file:travel-server/src/services/userService.ts",
            "file:travel-server/src/services/travelService.ts",
            "file:travel-server/src/services/chatService.ts",
            "file:travel-server/src/services/tripService.ts",
            "file:travel-server/src/services/db.ts",
        ]
    },
    {
        "id": "layer:ai-agent-orchestration",
        "name": "AI Agent 编排层",
        "description": "LangGraph 多 Agent 状态图：研究员、天气员、规划师（LLM+工具）、审核员、预算员、组装员，7 个节点 + 条件路由 + SSE 流适配",
        "nodeIds": [
            "file:travel-server/src/services/agent/graph/builder.ts",
            "file:travel-server/src/services/agent/graph/index.ts",
            "file:travel-server/src/services/agent/graph/state.ts",
            "file:travel-server/src/services/agent/graph/routing.ts",
            "file:travel-server/src/services/agent/graph/stream-adapter.ts",
            "file:travel-server/src/services/agent/graph/nodes/researcher.ts",
            "file:travel-server/src/services/agent/graph/nodes/weather.ts",
            "file:travel-server/src/services/agent/graph/nodes/planner-llm.ts",
            "file:travel-server/src/services/agent/graph/nodes/planner-tools.ts",
            "file:travel-server/src/services/agent/graph/nodes/reviewer.ts",
            "file:travel-server/src/services/agent/graph/nodes/budgeter.ts",
            "file:travel-server/src/services/agent/graph/nodes/finalizer.ts",
            "file:travel-server/src/services/agent/graph/tools/index.ts",
            "file:travel-server/src/services/agent/graph/tools/search-details.ts",
            "file:travel-server/src/services/agent/graph/tools/find-restaurants.ts",
            "file:travel-server/src/services/agent/graph/tools/transport-info.ts",
            "file:travel-server/src/services/agent/tools/index.ts",
            "file:travel-server/src/services/agent/tools/search.ts",
            "file:travel-server/src/services/agent/tools/weather.ts",
            "file:travel-server/src/services/agent/tools/calculator.ts",
            "file:travel-server/src/services/agent/schemas.ts",
            "file:travel-server/src/services/agent/types.ts",
            "file:travel-server/src/services/agent/utils/llm.ts",
        ]
    },
    {
        "id": "layer:data-layer",
        "name": "数据层",
        "description": "Prisma 数据库模型定义（User、Trip、TripDay、ChatMessage）、迁移记录、种子数据 + Prisma 生成的类型文件",
        "nodeIds": [
            "schema:travel-server/prisma/schema.prisma",
            "file:travel-server/prisma/seed.ts",
            "table:travel-server/prisma/migrations/20260615075541_init/migration.sql",
            "config:travel-server/prisma/migrations/migration_lock.toml",
            "file:travel-server/src/generated/client.ts",
            "file:travel-server/src/generated/browser.ts",
            "file:travel-server/src/generated/models.ts",
            "file:travel-server/src/generated/enums.ts",
            "file:travel-server/src/generated/commonInputTypes.ts",
            "file:travel-server/src/generated/models/User.ts",
            "file:travel-server/src/generated/models/Trip.ts",
            "file:travel-server/src/generated/models/TripDay.ts",
            "file:travel-server/src/generated/models/ChatMessage.ts",
            "file:travel-server/src/generated/internal/class.ts",
            "file:travel-server/src/generated/internal/prismaNamespace.ts",
            "file:travel-server/src/generated/internal/prismaNamespaceBrowser.ts",
        ]
    },
    {
        "id": "layer:utility",
        "name": "工具层",
        "description": "通用工具函数：SSE 流处理、配置等",
        "nodeIds": [
            "file:travel-server/src/utils/streamUtils.ts",
            "file:travel-h5/src/style/common.css",
        ]
    },
    {
        "id": "layer:infrastructure",
        "name": "基础设施层",
        "description": "Nginx 反向代理配置、Gzip/Brotli 压缩、SSE 流代理优化",
        "nodeIds": [
            "service:nginx.conf",
            "config:travel-h5/vite.config.ts",
        ]
    },
    {
        "id": "layer:root-config",
        "name": "根配置",
        "description": "项目根级别的 Git 忽略规则配置",
        "nodeIds": [
            "config:./.gitignore",
        ]
    },
]

# ── Phase 5: Guided Tour ──

tour = [
    {
        "order": 1,
        "title": "项目概览",
        "description": "阅读 README 了解项目全貌：智游（Travel-AI）是一个基于 Vue 3 + TypeScript 的移动端 AI 旅行规划应用，采用 LangGraph 多 Agent 协作架构，通过 SSE 流式推送 Agent 工作进度。核心亮点包括：多 Agent 协作编排、SSE 实时可视化、JWT 认证、生产级工程化。",
        "nodeIds": [
            "document:README.md",
        ]
    },
    {
        "order": 2,
        "title": "共享类型定义",
        "description": "前后端 API 契约的核心——shared/types.ts 定义了 User、TripPlan、DailyItinerary、AgentEvent 等 15 个共享类型，确保前后端数据结构一致。这是了解系统数据模型的起点。",
        "nodeIds": [
            "file:shared/types.ts",
        ]
    },
    {
        "order": 3,
        "title": "前端应用入口",
        "description": "main.ts 创建 Vue 应用实例，注册 Pinia 状态管理、Vue Router 路由、Vant 组件库，然后挂载到 #app。App.vue 是根组件，包含底部 TabBar 导航和页面过渡动画 PageTransition。",
        "nodeIds": [
            "file:travel-h5/src/main.ts",
            "file:travel-h5/src/App.vue",
            "file:travel-h5/index.html",
        ],
        "languageLesson": "Vue 3 应用通过 createApp() 创建实例，使用 app.use() 注册插件（Router、Pinia）。main.ts 是整个前端的入口文件，App.vue 是根组件。"
    },
    {
        "order": 4,
        "title": "前端路由系统",
        "description": "router/index.ts 定义了 7 条懒加载路由（首页、AI 对话、行程生成、历史记录、行程详情、登录注册、个人中心）。路由守卫在每次导航前检查 Pinia store 中的认证状态，自动拦截未登录用户。",
        "nodeIds": [
            "file:travel-h5/src/router/index.ts",
            "file:travel-h5/src/store/user.ts",
        ],
        "languageLesson": "Vue Router 的路由懒加载使用 () => import() 语法实现代码分割。全局前置守卫 beforeEach 检查 JWT Token 有效性，实现前端路由级权限控制。"
    },
    {
        "order": 5,
        "title": "AI 对话核心流程",
        "description": "chat/index.vue 是用户与 AI 交互的主战场。useAgentStream.ts（SSE 状态机）管理连接生命周期和流式解析，ChatBubble.vue 使用自研的 useMarkdown.ts 渲染 Markdown 回复，useSuggestedQuestions.ts 智能生成追问建议。SSE 失败时自动降级为 JSON 模式。",
        "nodeIds": [
            "file:travel-h5/src/views/chat/index.vue",
            "file:travel-h5/src/composables/useAgentStream.ts",
            "file:travel-h5/src/composables/useMarkdown.ts",
            "file:travel-h5/src/composables/useSuggestedQuestions.ts",
            "file:travel-h5/src/components/ChatBubble.vue",
        ],
        "languageLesson": "SSE (Server-Sent Events) 通过 fetch + ReadableStream 实现。服务端推送 event: chunk/data: xxx 格式的文本块，前端逐步渲染，产生打字机效果。"
    },
    {
        "order": 6,
        "title": "行程规划前端",
        "description": "detail/index.vue 展示 AgentPipeline 组件（步骤指示器），可视化 4 个 Agent 的工作进度。规划完成后显示 SpotItem（每日景点卡片）和 BudgetTable（预算分解）。",
        "nodeIds": [
            "file:travel-h5/src/views/detail/index.vue",
            "file:travel-h5/src/components/AgentPipeline.vue",
            "file:travel-h5/src/components/SpotItem.vue",
            "file:travel-h5/src/components/BudgetTable.vue",
        ]
    },
    {
        "order": 7,
        "title": "后端服务入口",
        "description": "src/index.ts 启动 Express 服务，注册 CORS 中间件和 JSON 解析，挂载 auth、travel、trip 三组路由。使用 authMiddleware 对需要认证的路由进行 JWT 保护。",
        "nodeIds": [
            "file:travel-server/src/index.ts",
            "file:travel-server/src/middleware/auth.ts",
        ],
        "languageLesson": "Express 中间件通过 app.use() 注册，按顺序执行。全局中间件作用于所有路由，路由级中间件作用于指定路径。"
    },
    {
        "order": 8,
        "title": "API 路由层",
        "description": "三组 RESTful 路由：auth.ts 处理注册/登录/个人信息，travel.ts 提供 AI 规划生成和对话 SSE 端点，trip.ts 管理行程的增删改查。travel 路由的 SSE 端点使用 proxy_buffering off 确保流式输出不被 Nginx 缓存。",
        "nodeIds": [
            "file:travel-server/src/routes/auth.ts",
            "file:travel-server/src/routes/travel.ts",
            "file:travel-server/src/routes/trip.ts",
        ]
    },
    {
        "order": 9,
        "title": "LangGraph AI Agent 编排",
        "description": "builder.ts 构建 7 节点 LangGraph 状态图：researcher（Tavily 搜索）→ weather（Open-Meteo）→ planner-llm（LLM + 3 工具：景点详情/交通/美食）→ reviewer（4 维度评分，< 70 分退回重试，最多 3 轮）→ budgeter（数学计算预算）→ finalizer（组装 TripPlan）。state.ts 定义 Agent 状态，routing.ts 控制条件路由，stream-adapter.ts 将 LangGraph 事件转为 SSE 格式。",
        "nodeIds": [
            "file:travel-server/src/services/agent/graph/builder.ts",
            "file:travel-server/src/services/agent/graph/state.ts",
            "file:travel-server/src/services/agent/graph/routing.ts",
            "file:travel-server/src/services/agent/graph/stream-adapter.ts",
            "file:travel-server/src/services/agent/graph/nodes/researcher.ts",
            "file:travel-server/src/services/agent/graph/nodes/weather.ts",
            "file:travel-server/src/services/agent/graph/nodes/planner-llm.ts",
            "file:travel-server/src/services/agent/graph/nodes/reviewer.ts",
            "file:travel-server/src/services/agent/graph/nodes/budgeter.ts",
            "file:travel-server/src/services/agent/graph/nodes/finalizer.ts",
        ],
        "languageLesson": "LangGraph 使用 StateGraph 定义节点和边，每个节点是一个函数，接收状态并返回部分更新。条件边根据运行时状态决定走哪条路径。这里 reviewer 的评分阈值（70分）决定了是重试（循环回 planner）还是继续。"
    },
    {
        "order": 10,
        "title": "数据模型与服务层",
        "description": "Prisma schema 定义了 4 张表（User、Trip、TripDay、ChatMessage），db.ts 导出 Prisma 单例。四个 Service（userService、travelService、chatService、tripService）封装业务逻辑，通过 Prisma 客户端操作 PostgreSQL。",
        "nodeIds": [
            "file:travel-server/src/services/db.ts",
            "schema:travel-server/prisma/schema.prisma",
            "file:travel-server/src/services/userService.ts",
            "file:travel-server/src/services/travelService.ts",
            "file:travel-server/src/services/chatService.ts",
            "file:travel-server/src/services/tripService.ts",
        ],
        "languageLesson": "Prisma 是一个类型安全 ORM。schema.prisma 定义数据模型，prisma db push 同步到数据库，prisma generate 生成 TypeScript 类型。服务层通过单例 Prisma 客户端执行 CRUD 操作。"
    },
    {
        "order": 11,
        "title": "生产部署架构",
        "description": "nginx.conf 配置反向代理：/api/* 转发到 Express (:3300)，其他请求服务 Vue 静态文件 (dist/)。关键优化：proxy_buffering off 确保 SSE 流式推送，gzip_static/brotli_static 零 CPU 开销返回预压缩文件，带 hash 的静态资源永久缓存。",
        "nodeIds": [
            "service:nginx.conf",
            "config:travel-h5/vite.config.ts",
        ],
        "languageLesson": "Nginx 作为反向代理时，proxy_pass 转发请求，proxy_set_header 透传原始信息。对于 SSE 流式端点，必须关闭 proxy_buffering 否则 Nginx 会缓存响应直到完成才一次性推送。"
    },
]

# ── Validation ──

# Only include nodeIds that exist in the graph
valid_node_ids = set(n['id'] for n in nodes)

for layer in layers:
    layer['nodeIds'] = [nid for nid in layer['nodeIds'] if nid in valid_node_ids]

for step in tour:
    step['nodeIds'] = [nid for nid in step['nodeIds'] if nid in valid_node_ids]

# ── Assemble final graph ──

git_hash = 'b8774a9f544fc183569256983dba1f9c3a0bedf9'

final_graph = {
    "version": "1.0.0",
    "project": {
        "name": "智游 (Travel-AI)",
        "languages": ["typescript", "vue", "javascript", "css", "html", "json", "markdown", "sql", "prisma", "toml", "nginx", "dotenv"],
        "frameworks": ["Vue 3", "Vite", "Pinia", "Vue Router", "Vant 4", "Express", "LangGraph", "LangChain", "Prisma"],
        "description": "基于 Vue 3 + TypeScript 的移动端 AI 旅行规划应用，采用 LangGraph 多 Agent 协作架构，通过 SSE 实时流式推送 Agent 工作进度，为你生成真实可信的个性化行程方案。",
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "gitCommitHash": git_hash
    },
    "nodes": nodes,
    "edges": edges,
    "layers": layers,
    "tour": tour
}

with open('.understand-anything/intermediate/assembled-graph.json', 'w', encoding='utf-8') as f:
    json.dump(final_graph, f, ensure_ascii=False, indent=2)

# Write layers and tour separately too
with open('.understand-anything/intermediate/layers.json', 'w', encoding='utf-8') as f:
    json.dump(layers, f, ensure_ascii=False, indent=2)

with open('.understand-anything/intermediate/tour.json', 'w', encoding='utf-8') as f:
    json.dump(tour, f, ensure_ascii=False, indent=2)

print(f'Final graph: {len(nodes)} nodes, {len(edges)} edges')
print(f'Layers: {len(layers)}')
for l in layers:
    print(f'  {l["name"]}: {len(l["nodeIds"])} nodes')
print(f'Tour steps: {len(tour)}')

# Check coverage
all_assigned = set()
for l in layers:
    all_assigned.update(l['nodeIds'])

# Get file-level nodes
file_types = {'file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint'}
file_nodes = set(n['id'] for n in nodes if n['type'] in file_types)
unassigned = file_nodes - all_assigned
if unassigned:
    print(f'Unassigned file nodes: {len(unassigned)}')
    for nid in sorted(unassigned):
        print(f'  {nid}')
