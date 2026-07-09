#!/usr/bin/env python3
"""Generate knowledge graph nodes and edges from scan results."""

import json
import os
import re
from pathlib import Path

ROOT = os.getcwd()

with open('.understand-anything/intermediate/scan-result.json', 'r', encoding='utf-8') as f:
    scan = json.load(f)

files = scan['files']
import_map = scan.get('importMap', {})

nodes = []
edges = []
node_ids = set()
edge_set = set()

# ── Node type helpers ──

def node_type_for(f):
    """Map fileCategory + extension to graph node type."""
    cat = f['fileCategory']
    p = f['path'].replace('\\', '/')
    base = os.path.basename(p)

    if cat == 'config':
        if base.endswith('.env') or base.endswith('.env.example'):
            return 'config'
        if base == 'nginx.conf':
            return 'service'
        return 'config'
    if cat == 'docs':
        return 'document'
    if cat == 'infra':
        return 'service'
    if cat == 'data':
        return 'table' if p.endswith('.sql') else 'data'
    if cat == 'schema':
        return 'schema'
    if cat == 'script':
        return 'file'
    if cat == 'markup':
        return 'file'
    if cat == 'code':
        ext = os.path.splitext(base)[1]
        if ext in ('.vue',):
            return 'file'  # Vue SFCs are file-level
        return 'file'
    return 'file'

def make_node_id(f):
    """Generate stable node ID from file path."""
    p = f['path'].replace('\\', '/')
    cat = f['fileCategory']
    base = os.path.basename(p)
    ext = os.path.splitext(base)[1]

    if cat == 'docs':
        return f'document:{p}'
    if cat == 'config':
        return f'config:{p}'
    if cat == 'infra':
        if p.endswith('.conf'):
            return f'service:{p}'
        return f'service:{p}'
    if cat == 'data':
        return f'table:{p}'
    if cat == 'schema':
        return f'schema:{p}'
    if cat == 'script':
        return f'file:{p}'
    if cat == 'markup':
        return f'file:{p}'
    return f'file:{p}'

def file_summary(f, content_snippet=''):
    """Generate a summary for a file based on its path and role."""
    p = f['path'].replace('\\', '/')
    base = os.path.basename(p)

    summaries = {
        'README.md': '项目主文档，介绍智游 AI 旅行规划助手的架构、技术栈、快速开始和部署',
        'nginx.conf': 'Nginx 生产环境配置，反向代理 + 静态资源服务 + SSE 流优化',
        '.gitignore': 'Git 忽略规则配置',
        'JD面试准备-针对性问答.md': 'JD 面试准备材料 — 针对性问答题',
        '面试学习指南.md': '面试学习指南文档',
        'shared/types.ts': '前后端共享 TypeScript 类型定义：User、TripPlan、AgentEvent 等接口',

        'travel-h5/README.md': '前端项目说明',
        'travel-h5/package.json': '前端依赖配置：Vue 3、Vant 4、Pinia、Vite',
        'travel-h5/tsconfig.json': 'TypeScript 编译配置',
        'travel-h5/vite.config.ts': 'Vite 构建配置：拆包策略、Gzip/Brotli 压缩、API 代理',
        'travel-h5/index.html': 'SPA 入口 HTML',
        'travel-h5/components.d.ts': 'Vant 组件自动导入类型声明',
        'travel-h5/.gitignore': '前端 Git 忽略规则',
        'travel-h5/src/main.ts': '前端应用入口：Vue 实例创建、插件注册、路由挂载',
        'travel-h5/src/env.d.ts': '环境变量类型声明',
        'travel-h5/src/App.vue': '根组件：底部 TabBar 导航',

        'travel-h5/src/router/index.ts': 'Vue Router 配置：7 条懒加载路由 + 路由守卫',
        'travel-h5/src/store/user.ts': '用户认证状态 Pinia Store（持久化）',
        'travel-h5/src/store/favorites.ts': '收藏状态 Pinia Store',
        'travel-h5/src/utils/request.ts': 'HTTP 客户端：Axios 实例 + JWT 拦截器 + fetch SSE',
        'travel-h5/src/utils/cities.ts': '热门城市数据',
        'travel-h5/src/style/common.css': '全局样式 + CSS 变量',

        'travel-server/package.json': '后端依赖配置：Express、LangGraph、Prisma',
        'travel-server/tsconfig.json': 'TypeScript 编译配置',
        'travel-server/nodemon.json': '开发环境热重载配置',
        'travel-server/.env': '环境变量（含 API 密钥等敏感信息）',
        'travel-server/.env.example': '环境变量模板',
        'travel-server/.gitignore': '后端 Git 忽略规则',
        'travel-server/prisma.config.ts': 'Prisma 数据库配置',
        'travel-server/src/index.ts': 'Express 服务入口：中间件注册、路由挂载、端口监听',

        'travel-server/src/routes/auth.ts': '认证路由：/api/auth/* 注册、登录、个人信息',
        'travel-server/src/routes/travel.ts': '旅行规划路由：/api/travel/* AI 规划、对话、SSE 流',
        'travel-server/src/routes/trip.ts': '行程路由：/api/trips/* 行程 CRUD',
        'travel-server/src/middleware/auth.ts': 'JWT 认证中间件：Token 验证、用户身份提取',
        'travel-server/src/services/db.ts': 'Prisma 客户端单例',
        'travel-server/src/services/userService.ts': '用户服务层：注册、登录、信息更新',
        'travel-server/src/services/travelService.ts': '旅行规划编排服务：LangGraph 工作流调用',
        'travel-server/src/services/chatService.ts': '对话记录服务：消息存储、历史查询',
        'travel-server/src/services/tripService.ts': '行程 CRUD 服务',
        'travel-server/src/utils/streamUtils.ts': 'SSE 流工具函数',

        'travel-server/src/services/agent/schemas.ts': 'Zod 运行时验证 Schema',
        'travel-server/src/services/agent/types.ts': 'Agent 类型定义',
        'travel-server/src/services/agent/utils/llm.ts': 'LLM 工厂函数：DeepSeek / SiliconFlow 初始化',

        'travel-server/prisma/schema.prisma': '数据库模型：User、Trip、TripDay、ChatMessage',
        'travel-server/prisma/seed.ts': '数据库种子数据',
        'travel-server/prisma/migrations/20260615075541_init/migration.sql': '初始数据库迁移 SQL',
        'travel-server/prisma/migrations/migration_lock.toml': 'Prisma 迁移锁文件',
    }

    # Vue component summaries
    vue_summaries = {
        'ChatBubble.vue': 'AI/用户消息气泡组件：Markdown 渲染 + 一键复制',
        'AgentPipeline.vue': 'Agent 步骤指示器组件：可视化多 Agent 工作进度',
        'CityCard.vue': '热门城市卡片组件',
        'SpotItem.vue': '景点详情卡片组件',
        'BudgetTable.vue': '预算分解柱状图组件',
        'StatCard.vue': '统计卡片组件',
        'SkeletonCard.vue': '骨架屏占位符组件',
        'PageTransition.vue': '页面滑动过渡动画组件',
    }
    if base in vue_summaries:
        return vue_summaries[base]

    # View summaries
    view_summaries = {
        'home/index.vue': '首页：城市推荐卡片 + 搜索入口',
        'chat/index.vue': 'AI 对话页：SSE 流式聊天 + 建议追问',
        'login/index.vue': '登录注册页：密码强度指示 + 记住我',
        'detail/index.vue': '行程生成页：AgentPipeline 可视化 + 行程展示',
        'history/index.vue': '历史行程页：下拉刷新 + 分页搜索',
        'trip-detail/index.vue': '行程详情页：每日景点卡片',
        'profile/index.vue': '个人中心页：统计 + 设置',
    }
    for vp, summary in view_summaries.items():
        if p.endswith(vp):
            return summary

    # Composable summaries
    comp_summaries = {
        'useAgentStream.ts': 'Agent SSE 流式管理（状态机）：连接、解析、降级 JSON',
        'useMarkdown.ts': '轻量 Markdown → HTML 渲染器（自研替代 200KB+ 第三方库）',
        'useSuggestedQuestions.ts': '智能追问建议生成器',
        'useClipboard.ts': '剪贴板操作封装',
        'usePasswordStrength.ts': '密码强度评估工具',
    }
    if base in comp_summaries:
        return comp_summaries[base]

    # Agent graph nodes
    graph_summaries = {
        'builder.ts': 'LangGraph 状态图编排：7 个 Agent 节点 + 条件路由',
        'index.ts': 'Agent 图谱模块导出入口',
        'state.ts': 'Agent 状态类型定义（Annotation）',
        'routing.ts': 'Agent 路由逻辑：评分阈值判断 → 修正/继续',
        'stream-adapter.ts': 'SSE 流适配器：LangGraph 事件 → SSE 格式',
        'researcher.ts': '研究员 Agent：Tavily 搜索真实景点信息',
        'weather.ts': '天气员 Agent：Open-Meteo 天气数据查询',
        'planner-llm.ts': '核心规划师 Agent：LLM + 3 工具（搜索/交通/美食）',
        'planner-tools.ts': '规划师工具：Tavily 搜索增强',
        'reviewer.ts': '审核员 Agent：4 维度评分（完整度/真实性/预算/天气）+ 自我反思',
        'budgeter.ts': '预算员 Agent：数学计算预算分解',
        'finalizer.ts': '组装员 Agent：最终 TripPlan 组装 + SSE complete',
    }
    if base in graph_summaries:
        return graph_summaries[base]

    # Agent tools
    tool_summaries = {
        'search.ts': 'Tavily 搜索工具定义',
        'weather.ts': 'Open-Meteo 天气工具定义',
        'calculator.ts': '预算计算工具定义',
        'search-details.ts': '景点详情搜索工具',
        'find-restaurants.ts': '附近餐厅搜索工具',
        'transport-info.ts': '交通路线查询工具',
        'index.ts': '工具模块导出入口',
    }
    if base in tool_summaries:
        return tool_summaries[base]

    # Generated files
    if 'generated' in p:
        if base == 'client.ts': return 'Prisma 客户端导出'
        if base == 'browser.ts': return 'Prisma 浏览器端客户端'
        if base == 'models.ts': return 'Prisma 模型类型汇总'
        if base == 'enums.ts': return 'Prisma 枚举类型'
        if base == 'commonInputTypes.ts': return 'Prisma 通用输入类型'
        if 'models/' in p: return f'Prisma 生成的 {base.replace(".ts","")} 模型类型'
        if 'internal/' in p: return f'Prisma 内部类型定义'

    return f'{os.path.splitext(base)[0]}: {f["language"]} {f["fileCategory"]}'

def compute_tags(f):
    """Generate tags for a file node."""
    p = f['path'].replace('\\', '/')
    tags = ['untagged']

    if 'travel-h5' in p:
        tags.append('frontend')
    if 'travel-server' in p:
        tags.append('backend')
    if 'shared/' in p:
        tags.append('shared')

    if 'views/' in p:
        tags.append('page')
    if 'components/' in p:
        tags.append('component')
    if 'composables/' in p:
        tags.append('composable')
    if 'store/' in p or 'stores/' in p:
        tags.append('store')
    if 'router/' in p:
        tags.append('router')
    if 'utils/' in p:
        tags.append('utility')
    if 'routes/' in p:
        tags.append('route')
    if 'middleware/' in p:
        tags.append('middleware')
    if 'services/' in p:
        tags.append('service')
    if 'agent/' in p:
        tags.append('agent')
    if 'graph/' in p and 'nodes/' in p:
        tags.append('agent-node')
    if 'tools/' in p:
        tags.append('tool')
    if 'prisma/' in p:
        tags.append('database')
    if 'generated/' in p:
        tags.append('generated')
    if f['language'] in ('typescript', 'javascript', 'vue'):
        tags.append('typescript')
    if f['language'] == 'css':
        tags.append('styling')

    if 'tags' in p and p.endswith('.ts'):
        tags.append('test')

    # Remove untagged if we have real tags
    if len(tags) > 1 and 'untagged' in tags:
        tags.remove('untagged')

    return tags

def complexity_from_lines(lines):
    if lines < 50: return 'simple'
    if lines < 200: return 'moderate'
    return 'complex'

# ── Generate file-level nodes ──

for f in files:
    p = f['path'].replace('\\', '/')
    node_id = make_node_id(f)
    node = {
        'id': node_id,
        'type': node_type_for(f),
        'name': os.path.basename(p),
        'filePath': p,
        'summary': file_summary(f),
        'tags': compute_tags(f),
        'language': f.get('language', 'unknown'),
    }
    if f.get('sizeLines', 0) > 0:
        node['complexity'] = complexity_from_lines(f['sizeLines'])

    nodes.append(node)
    node_ids.add(node_id)

# ── Generate edges from import map ──

def resolve_import_to_node_id(import_path, from_file_path):
    """Resolve a relative import to a target node ID using fileSet."""
    from_dir = os.path.dirname(from_file_path)

    if import_path.startswith('@/'):
        pkg = 'travel-h5' if 'travel-h5' in from_file_path else 'travel-server'
        resolved = pkg + '/src/' + import_path[2:]
    elif import_path.startswith('../'):
        parts = import_path.split('/')
        d = from_dir
        for part in parts:
            if part == '..':
                d = os.path.dirname(d)
            elif part != '.':
                d = d + '/' + part
        resolved = d
    elif import_path.startswith('./'):
        resolved = from_dir + '/' + import_path[2:]
    else:
        return None

    # Try with various extensions
    extensions = ['', '.ts', '.tsx', '.vue', '.js', '/index.ts', '/index.vue']
    for ext in extensions:
        candidate = resolved + ext
        for f in files:
            fp = f['path'].replace('\\', '/')
            if fp == candidate:
                return make_node_id(f)
    return None

for from_path, imports in import_map.items():
    from_path_clean = from_path.replace('./', '', 1).replace('\\', '/')
    from_id = None
    for f in files:
        if f['path'].replace('\\', '/') == from_path_clean:
            from_id = make_node_id(f)
            break

    if not from_id:
        continue

    for imp in imports:
        target_id = resolve_import_to_node_id(imp, from_path_clean)
        if target_id and target_id in node_ids and target_id != from_id:
            edge_key = (from_id, target_id, 'imports')
            if edge_key not in edge_set:
                edge_set.add(edge_key)
                edges.append({
                    'source': from_id,
                    'target': target_id,
                    'type': 'imports',
                    'weight': 0.7
                })

# ── Semantic edges based on file relationships ──

def add_edge(source, target, etype, weight=0.5):
    if source in node_ids and target in node_ids and source != target:
        key = (source, target, etype)
        if key not in edge_set:
            edge_set.add(key)
            edges.append({'source': source, 'target': target, 'type': etype, 'weight': weight})

def node_by_path(pattern):
    """Find node IDs whose filePath contains pattern."""
    return [n['id'] for n in nodes if pattern in n.get('filePath', '')]

def node_by_name(name):
    for n in nodes:
        if n.get('name') == name:
            return n['id']
    return None

# Entry point dependencies
add_edge('file:travel-server/src/index.ts', 'file:travel-server/src/routes/auth.ts', 'imports', 0.7)
add_edge('file:travel-server/src/index.ts', 'file:travel-server/src/routes/travel.ts', 'imports', 0.7)
add_edge('file:travel-server/src/index.ts', 'file:travel-server/src/routes/trip.ts', 'imports', 0.7)

# Route → service dependencies
add_edge('file:travel-server/src/routes/auth.ts', 'file:travel-server/src/middleware/auth.ts', 'imports', 0.7)
add_edge('file:travel-server/src/routes/auth.ts', 'file:travel-server/src/services/userService.ts', 'imports', 0.7)
add_edge('file:travel-server/src/routes/travel.ts', 'file:travel-server/src/middleware/auth.ts', 'imports', 0.7)
add_edge('file:travel-server/src/routes/travel.ts', 'file:travel-server/src/services/travelService.ts', 'imports', 0.7)
add_edge('file:travel-server/src/routes/travel.ts', 'file:travel-server/src/services/chatService.ts', 'imports', 0.7)
add_edge('file:travel-server/src/routes/trip.ts', 'file:travel-server/src/middleware/auth.ts', 'imports', 0.7)
add_edge('file:travel-server/src/routes/trip.ts', 'file:travel-server/src/services/tripService.ts', 'imports', 0.7)

# Service → database
add_edge('file:travel-server/src/services/userService.ts', 'file:travel-server/src/services/db.ts', 'imports', 0.7)
add_edge('file:travel-server/src/services/travelService.ts', 'file:travel-server/src/services/db.ts', 'imports', 0.7)
add_edge('file:travel-server/src/services/chatService.ts', 'file:travel-server/src/services/db.ts', 'imports', 0.7)
add_edge('file:travel-server/src/services/tripService.ts', 'file:travel-server/src/services/db.ts', 'imports', 0.7)

# Agent graph edges
graph_nodes = [
    'researcher.ts', 'weather.ts', 'planner-llm.ts', 'planner-tools.ts',
    'reviewer.ts', 'budgeter.ts', 'finalizer.ts'
]
for gn in graph_nodes:
    add_edge(
        f'file:travel-server/src/services/agent/graph/builder.ts',
        f'file:travel-server/src/services/agent/graph/nodes/{gn}',
        'imports', 0.7
    )
add_edge('file:travel-server/src/services/agent/graph/builder.ts', 'file:travel-server/src/services/agent/graph/state.ts', 'imports', 0.7)
add_edge('file:travel-server/src/services/agent/graph/builder.ts', 'file:travel-server/src/services/agent/graph/routing.ts', 'imports', 0.7)

# Agent graph → schemas, types, LLM
add_edge('file:travel-server/src/services/agent/graph/nodes/researcher.ts', 'file:travel-server/src/services/agent/schemas.ts', 'imports', 0.7)
add_edge('file:travel-server/src/services/agent/graph/nodes/planner-llm.ts', 'file:travel-server/src/services/agent/schemas.ts', 'imports', 0.7)
add_edge('file:travel-server/src/services/agent/graph/builder.ts', 'file:travel-server/src/services/agent/utils/llm.ts', 'imports', 0.7)
add_edge('file:travel-server/src/services/agent/graph/nodes/planner-llm.ts', 'file:travel-server/src/services/agent/utils/llm.ts', 'imports', 0.7)

# Agent tool edges
tool_nodes = ['search.ts', 'weather.ts', 'calculator.ts']
for tn in tool_nodes:
    add_edge(
        f'file:travel-server/src/services/agent/tools/index.ts',
        f'file:travel-server/src/services/agent/tools/{tn}',
        'imports', 0.7
    )

# Graph tools
graph_tools = ['search-details.ts', 'find-restaurants.ts', 'transport-info.ts']
for gt in graph_tools:
    add_edge(
        f'file:travel-server/src/services/agent/graph/tools/index.ts',
        f'file:travel-server/src/services/agent/graph/tools/{gt}',
        'imports', 0.7
    )

# Service → agent
add_edge('file:travel-server/src/services/travelService.ts', 'file:travel-server/src/services/agent/graph/builder.ts', 'imports', 0.7)
add_edge('file:travel-server/src/services/travelService.ts', 'file:travel-server/src/services/agent/graph/index.ts', 'imports', 0.7)

# Vue app entry
add_edge('file:travel-h5/src/main.ts', 'file:travel-h5/src/App.vue', 'imports', 0.7)
add_edge('file:travel-h5/src/main.ts', 'file:travel-h5/src/router/index.ts', 'imports', 0.7)

# Router → views
view_files = ['chat', 'detail', 'home', 'login', 'history', 'trip-detail', 'profile']
for vf in view_files:
    add_edge('file:travel-h5/src/router/index.ts', f'file:travel-h5/src/views/{vf}/index.vue', 'imports', 0.7)

# Views → components (common patterns)
add_edge('file:travel-h5/src/views/chat/index.vue', 'file:travel-h5/src/components/ChatBubble.vue', 'imports', 0.7)
add_edge('file:travel-h5/src/views/chat/index.vue', 'file:travel-h5/src/components/AgentPipeline.vue', 'imports', 0.7)
add_edge('file:travel-h5/src/views/home/index.vue', 'file:travel-h5/src/components/CityCard.vue', 'imports', 0.7)
add_edge('file:travel-h5/src/views/detail/index.vue', 'file:travel-h5/src/components/AgentPipeline.vue', 'imports', 0.7)
add_edge('file:travel-h5/src/views/detail/index.vue', 'file:travel-h5/src/components/BudgetTable.vue', 'imports', 0.7)
add_edge('file:travel-h5/src/views/detail/index.vue', 'file:travel-h5/src/components/SpotItem.vue', 'imports', 0.7)
add_edge('file:travel-h5/src/views/history/index.vue', 'file:travel-h5/src/components/SkeletonCard.vue', 'imports', 0.7)
add_edge('file:travel-h5/src/views/trip-detail/index.vue', 'file:travel-h5/src/components/SpotItem.vue', 'imports', 0.7)
add_edge('file:travel-h5/src/views/profile/index.vue', 'file:travel-h5/src/components/StatCard.vue', 'imports', 0.7)

# Components using composables
add_edge('file:travel-h5/src/components/ChatBubble.vue', 'file:travel-h5/src/composables/useMarkdown.ts', 'imports', 0.7)
add_edge('file:travel-h5/src/components/ChatBubble.vue', 'file:travel-h5/src/composables/useClipboard.ts', 'imports', 0.7)
add_edge('file:travel-h5/src/views/chat/index.vue', 'file:travel-h5/src/composables/useAgentStream.ts', 'imports', 0.7)
add_edge('file:travel-h5/src/views/chat/index.vue', 'file:travel-h5/src/composables/useSuggestedQuestions.ts', 'imports', 0.7)
add_edge('file:travel-h5/src/views/login/index.vue', 'file:travel-h5/src/composables/usePasswordStrength.ts', 'imports', 0.7)

# Store dependencies
add_edge('file:travel-h5/src/store/user.ts', 'file:travel-h5/src/utils/request.ts', 'imports', 0.7)

# Config → code relationships
add_edge('config:travel-h5/package.json', 'file:travel-h5/src/main.ts', 'configures', 0.6)
add_edge('config:travel-server/package.json', 'file:travel-server/src/index.ts', 'configures', 0.6)
add_edge('config:travel-h5/vite.config.ts', 'file:travel-h5/index.html', 'configures', 0.6)
add_edge('config:travel-server/.env', 'file:travel-server/src/index.ts', 'configures', 0.6)
add_edge('config:travel-server/tsconfig.json', 'file:travel-server/src/index.ts', 'configures', 0.6)
add_edge('config:travel-h5/tsconfig.json', 'file:travel-h5/src/main.ts', 'configures', 0.6)

# Database schema edges
add_edge('schema:travel-server/prisma/schema.prisma', 'file:travel-server/src/services/db.ts', 'defines_schema', 0.8)
add_edge('file:travel-server/src/services/db.ts', 'schema:travel-server/prisma/schema.prisma', 'imports', 0.7)

# Generated code from schema
gen_files = [n for n in nodes if 'generated' in n.get('filePath', '')]
for gf in gen_files:
    add_edge('schema:travel-server/prisma/schema.prisma', gf['id'], 'defines_schema', 0.8)
    add_edge('file:travel-server/src/services/db.ts', gf['id'], 'imports', 0.7)

# Nginx serves
add_edge('service:nginx.conf', 'file:travel-server/src/index.ts', 'serves', 0.5)
add_edge('service:nginx.conf', 'file:travel-h5/index.html', 'serves', 0.5)

# Documentation edges
add_edge('document:README.md', 'file:travel-h5/src/main.ts', 'documents', 0.5)
add_edge('document:README.md', 'file:travel-server/src/index.ts', 'documents', 0.5)
add_edge('document:README.md', 'schema:travel-server/prisma/schema.prisma', 'documents', 0.5)
add_edge('document:README.md', 'service:nginx.conf', 'documents', 0.5)

# Shared types referenced by both
for n in nodes:
    fp = n.get('filePath', '')
    if fp.startswith('travel-h5/') and n['type'] == 'file':
        add_edge('file:shared/types.ts', n['id'], 'related', 0.3)
    if fp.startswith('travel-server/src/') and n['type'] == 'file' and 'generated' not in fp:
        add_edge('file:shared/types.ts', n['id'], 'related', 0.3)

# Prisma seed imports
add_edge('file:travel-server/prisma/seed.ts', 'file:travel-server/src/services/db.ts', 'imports', 0.7)

# Stream adapter
add_edge('file:travel-server/src/services/agent/graph/stream-adapter.ts', 'file:travel-server/src/utils/streamUtils.ts', 'imports', 0.7)
add_edge('file:travel-server/src/services/agent/graph/stream-adapter.ts', 'file:travel-server/src/services/agent/graph/state.ts', 'imports', 0.7)

# Plumber tools → search tool
add_edge('file:travel-server/src/services/agent/graph/nodes/planner-tools.ts', 'file:travel-server/src/services/agent/tools/search.ts', 'imports', 0.7)

# Router guards → store
add_edge('file:travel-h5/src/router/index.ts', 'file:travel-h5/src/store/user.ts', 'imports', 0.7)

# ── Write output ──

output = {
    'nodes': nodes,
    'edges': edges
}

with open('.understand-anything/intermediate/assembled-graph.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

node_types = {}
for n in nodes:
    node_types[n["type"]] = node_types.get(n["type"], 0) + 1
edge_types = {}
for e in edges:
    edge_types[e["type"]] = edge_types.get(e["type"], 0) + 1

print(f'Generated {len(nodes)} nodes and {len(edges)} edges')
print(f'  Nodes by type: {json.dumps(node_types, ensure_ascii=False)}')
print(f'  Edges by type: {json.dumps(edge_types, ensure_ascii=False)}')
