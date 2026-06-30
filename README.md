# 🧭 智游 — AI 智能旅行规划助手

> 基于 **Vue 3 + TypeScript** 的移动端 AI 旅行规划应用，采用 **LangGraph 多 Agent 协作**架构，通过 **SSE 实时流式推送** Agent 工作进度，为你生成真实可信的个性化行程方案。

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Pinia-3.0-FFD859?logo=vue.js&logoColor=black" alt="Pinia" />
  <img src="https://img.shields.io/badge/LangGraph-2.0-1C3C3C?logo=langchain&logoColor=white" alt="LangGraph" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Nginx-Production-009639?logo=nginx&logoColor=white" alt="Nginx" />
</p>

---

## ✨ 核心亮点

- 🤖 **多 Agent 协作编排** — 4 个 AI Agent（研究员 / 天气员 / 规划师 / 预算师）并行工作，规划师配备 3 个工具（搜索景点 / 交通查询 / 美食推荐），自我反思审核迭代直至质量达标
- 📡 **SSE 实时可视化** — Agent 工作进度通过 Server-Sent Events 实时推送到前端，`AgentPipeline` 组件以步骤指示器呈现完整工作流
- 📱 **移动端优先** — Vant 4 移动端组件库，骨架屏加载、页面过渡动画、响应式布局，媲美原生 App 体验
- 🔐 **JWT 认证体系** — 注册/登录/个人中心，路由守卫自动拦截过期 Token，支持记住我功能
- 📦 **生产级工程化** — Gzip + Brotli 双层预压缩、路由懒加载、静态资源强缓存、Nginx 反向代理 + SSE 流式代理优化
- 🎯 **自研轻量方案** — 自研 Markdown 渲染器（替代 200KB+ 第三方库），SSE 失败自动降级 JSON 模式

---

## 🛠 技术栈

| 层级            | 技术                                      | 说明                                   |
| --------------- | ----------------------------------------- | -------------------------------------- |
| **前端框架**    | Vue 3 (Composition API +`<script setup>`) | 逻辑复用、TypeScript 友好              |
| **构建工具**    | Vite 8                                    | 极速 HMR，开箱即用                     |
| **UI 组件库**   | Vant 4                                    | 移动端专属，按需导入                   |
| **状态管理**    | Pinia 3 + 持久化插件                      | localStorage 持久化用户状态            |
| **路由**        | Vue Router 5                              | History 模式 + 懒加载 + 路由守卫       |
| **HTTP 客户端** | Axios + 原生 fetch                        | Axios 用于 REST API，fetch 用于 SSE 流 |
| **后端框架**    | Express 4.19 + TypeScript                 | RESTful API + SSE 端点                 |
| **AI 编排**     | LangChain.js + LangGraph V2               | 多 Agent 状态图，工具调用，自我反思    |
| **LLM**         | DeepSeek / SiliconFlow                    | OpenAI 兼容 API，可灵活切换            |
| **数据库**      | PostgreSQL + Prisma 7                     | 类型安全 ORM，JSONB 存储景点数据       |
| **认证**        | JWT + bcryptjs                            | Token 认证，密码哈希存储               |
| **部署**        | Nginx                                     | 反向代理 + 静态资源服务 + SSL 终端     |

---

## 🏗 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         浏览器 (Mobile H5)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ 首页/推荐 │  │ AI 对话  │  │ 行程管理  │  │ 个人中心     │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │             │               │            │
│  ┌────┴──────────────┴─────────────┴───────────────┴───────┐   │
│  │              Pinia Store (User / Favorites)              │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────┴──────────────────────────────┐   │
│  │      Axios (REST) + fetch (SSE) — JWT 自动附加          │   │
│  └──────────────────────────┬──────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Nginx (:80)     │
                    │  gzip_static +     │
                    │  brotli_static     │
                    └─────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
    静态资源 (dist/)                  /api/* 反向代理
              │                               │
              │                       ┌───────┴───────┐
              │                       │ Express (:3300)│
              │                       │                │
              │                       │  Auth  Travel  │
              │                       │  路由  路由    │
              │                       │                │
              │                       │  ┌──────────┐  │
              │                       │  │ LangGraph │  │
              │                       │  │   V2      │  │
              │                       │  │           │  │
              │                       │  │ researcher│  │
              │                       │  │ weather   │  │
              │                       │  │ planner↔  │  │
              │                       │  │ reviewer  │──┼──→ DeepSeek API
              │                       │  │ budgeter  │  │
              │                       │  │ finalizer │  │
              │                       │  └──────────┘  │
              │                       │                │
              │                       │  ┌──────────┐  │
              │                       │  │ Prisma   │──┼──→ PostgreSQL
              │                       │  └──────────┘  │
              │                       └────────────────┘
              │
              └──→ 外部 API
                    • Tavily Search (景点搜索)
                    • Open-Meteo (免费天气)
```

### AI Agent 工作流

```
START
  │
  ├──→ researcher ────→ Tavily 搜索真实景点信息
  │
  ├──→ weather_info ──→ Open-Meteo 天气数据
  │
  │     ┌──────────────┐
  └─────┤  planner_llm  │←── 3 个工具增强：
        │  (核心规划师)  │    • search_attraction_details（核实票价）
        │               │    • get_transport_options（交通路线）
        │               │    • find_nearby_restaurants（美食推荐）
        └──────┬────────┘
               │
        ┌──────┴──────┐
        │   reviewer   │  4 维度评分（完整度 / 真实性 / 预算 / 天气）
        └──────┬──────┘
               │
        score < 70  ──→ 返回 planner 修正（最多 3 轮）
        score ≥ 70  ──→ 继续
               │
        ┌──────┴──────┐
        │  budgeter    │  数学计算预算分解
        └──────┬──────┘
               │
        ┌──────┴──────┐
        │  finalizer   │  组装最终 TripPlan → SSE complete
        └─────────────┘
```

---

## 📂 项目结构

```
travel-AI-main/
├── shared/                        # 前后端共享 TypeScript 类型
│   └── types.ts                   # User / TripPlan / AgentEvent 等类型定义
│
├── travel-h5/                     # 前端 — Vue 3 移动端 SPA
│   ├── src/
│   │   ├── views/                 # 7 个页面（懒加载）
│   │   │   ├── home/              #   首页 — 城市推荐卡片 + 搜索入口
│   │   │   ├── chat/              #   AI 对话 — 流式聊天 + 建议追问
│   │   │   ├── login/             #   登录注册 — 密码强度指示 + 记住我
│   │   │   ├── detail/            #   行程生成 — AgentPipeline 可视化
│   │   │   ├── history/           #   历史行程 — 下拉刷新 + 分页搜索
│   │   │   ├── trip-detail/       #   行程详情 — 每日景点卡片
│   │   │   └── profile/           #   个人中心 — 统计 + 设置
│   │   ├── components/            # 8 个可复用组件
│   │   │   ├── AgentPipeline.vue  #   Agent 步骤指示器
│   │   │   ├── ChatBubble.vue     #   AI/用户消息气泡 (Markdown + 复制)
│   │   │   ├── CityCard.vue       #   热门城市卡片
│   │   │   ├── SpotItem.vue       #   景点详情卡片
│   │   │   ├── BudgetTable.vue    #   预算分解柱状图
│   │   │   ├── StatCard.vue       #   统计卡片
│   │   │   ├── SkeletonCard.vue   #   骨架屏占位符
│   │   │   └── PageTransition.vue #   页面滑动过渡
│   │   ├── composables/           # 5 个可组合函数
│   │   │   ├── useAgentStream.ts  #   Agent SSE 流式管理 (状态机)
│   │   │   ├── useMarkdown.ts     #   轻量 Markdown → HTML 渲染器
│   │   │   ├── useSuggestedQuestions.ts  # 智能追问建议生成
│   │   │   ├── useClipboard.ts    #   剪贴板操作
│   │   │   └── usePasswordStrength.ts    # 密码强度评估
│   │   ├── stores/                # Pinia 状态管理
│   │   │   ├── user.ts            #   用户认证状态 (持久化)
│   │   │   └── favorites.ts       #   收藏状态 (localStorage)
│   │   ├── router/                # Vue Router 配置 + 路由守卫
│   │   ├── utils/                 # HTTP 客户端 (Axios + fetch SSE)
│   │   ├── style/                 # 全局样式 + CSS 变量
│   │   ├── App.vue                # 根组件 (底部 TabBar)
│   │   └── main.ts                # 应用入口
│   ├── vite.config.ts             # Vite 配置 (拆包 / 压缩 / 代理)
│   ├── tsconfig.json
│   └── package.json
│
├── travel-server/                 # 后端 — Express + LangGraph AI
│   ├── src/
│   │   ├── routes/                # 路由层
│   │   │   ├── auth.ts            #   /api/auth/* (登录/注册/个人信息)
│   │   │   ├── travel.ts          #   /api/travel/* (AI 规划 / 对话 / SSE)
│   │   │   └── trip.ts            #   /api/trips/* (行程 CRUD)
│   │   ├── services/              # 服务层
│   │   │   ├── travelService.ts   #   行程编排服务
│   │   │   ├── chatService.ts     #   对话记录服务
│   │   │   ├── userService.ts     #   用户 CRUD 服务
│   │   │   ├── tripService.ts     #   行程 CRUD 服务
│   │   │   ├── db.ts              #   Prisma 单例
│   │   │   └── agent/             #   LangGraph AI Agent
│   │   │       ├── graph/
│   │   │       │   ├── builder.ts       # 状态图编排 (7 节点)
│   │   │       │   ├── nodes/
│   │   │       │   │   ├── researcher.ts   # 搜索 Agent
│   │   │       │   │   ├── weather.ts      # 天气 Agent
│   │   │       │   │   ├── planner.ts      # 规划 Agent (LLM + 工具调用)
│   │   │       │   │   ├── reviewer.ts     # 审核 Agent (自我反思)
│   │   │       │   │   ├── budgeter.ts     # 预算 Agent (数学计算)
│   │   │       │   │   └── finalizer.ts    # 组装 Agent
│   │   │       │   └── tools/        # LLM 工具定义
│   │   │       ├── schemas.ts        # Zod 运行时验证
│   │   │       └── utils/
│   │   │           └── llm.ts        # LLM 工厂函数
│   │   └── middleware/
│   │       └── auth.ts           # JWT 认证中间件
│   ├── prisma/
│   │   ├── schema.prisma         # 数据库模型 (User / Trip / TripDay / ChatMessage)
│   │   └── seed.ts
│   ├── tsconfig.json
│   ├── .env                      # 环境变量 (敏感信息，勿提交)
│   └── package.json
│
├── nginx.conf                     # 生产环境 Nginx 配置
└── README.md
```

---

## 🚀 快速开始

### 环境要求

| 依赖       | 版本   |
| ---------- | ------ |
| Node.js    | ≥ 18   |
| PostgreSQL | ≥ 14   |
| pnpm / npm | 最新版 |

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd travel-AI-main
```

### 2. 配置后端

```bash
cd travel-server

# 安装依赖
npm install

# 配置环境变量（复制模板后填入你的密钥）
cp .env .env.local
```

编辑 `.env` 文件，填入以下必要配置：

| 变量                | 说明                | 示例                                              |
| ------------------- | ------------------- | ------------------------------------------------- |
| `JWT_SECRET`        | JWT 签名密钥        | `your-secret-key`                                 |
| `DATABASE_URL`      | PostgreSQL 连接串   | `postgresql://user:pass@localhost:5432/travel_ai` |
| `DEEPSEEK_API_KEY`  | DeepSeek API Key    | `sk-xxxx`                                         |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址   | `https://api.deepseek.com/v1`                     |
| `DEEPSEEK_MODEL`    | 使用的模型          | `deepseek-chat`                                   |
| `TAVILY_API_KEY`    | Tavily 搜索 API Key | `tvly-xxxx`                                       |

> 💡 **免费额度**：Tavily 提供 1000 次/月免费搜索额度，[点此注册](https://tavily.com)

```bash
# 初始化数据库
npm run db:push     # 同步 Prisma schema 到 PostgreSQL
npm run db:generate # 生成 Prisma Client

# 启动开发服务器
npm run dev         # → http://localhost:3300
```

### 3. 配置前端

```bash
cd travel-h5

# 安装依赖
npm install

# 启动开发服务器
npm run dev         # → http://localhost:5173
```

> 开发模式下，Vite 自动将 `/api/*` 请求代理到后端 `http://localhost:3300`，无需额外配置。

### 4. 验证运行

1. 浏览器打开 `http://localhost:5173`
2. 注册一个新账号
3. 在首页输入城市和预算，点击「开始规划」
4. 观察 AgentPipeline 组件实时展示 4 个 Agent 的工作进度
5. 规划完成后查看完整行程方案

---

## 🚢 生产部署

### 构建前端

```bash
cd travel-h5
npm run build        # 产物输出到 dist/
```

构建过程会：

- TypeScript 类型检查（`vue-tsc --noEmit`）
- Vite 打包 + 代码分割（vant / vue-vendor 独立 chunk）
- 自动生成 `.gz` 和 `.br` 预压缩文件

### 启动后端

```bash
cd travel-server
npm start            # tsx 直接运行，无需编译
```

推荐使用 **PM2** 守护进程：

```bash
npm install -g pm2
pm2 start npm --name travel-server -- start
```

### 配置 Nginx

```bash
# 将项目中的 nginx.conf 链接到 Nginx 配置目录
sudo ln -s /path/to/travel-AI-main/nginx.conf /etc/nginx/sites-enabled/travel-ai

# 修改 nginx.conf 中的路径和域名
sudo vim nginx.conf
#   root → 改为 travel-h5/dist/ 的绝对路径
#   server_name → 改为你的域名

# 验证并重载
sudo nginx -t
sudo nginx -s reload
```

Nginx 关键优化：

- **SSE 流代理**：`proxy_buffering off` 确保 AI 流式输出逐字推送
- **预压缩直返**：`gzip_static on` + `brotli_static on`，零 CPU 开销
- **缓存策略**：带 hash 的 JS/CSS 永久缓存，`index.html` 不缓存

---

## 🎯 核心功能

### 用户系统

- 注册（密码强度实时评估）/ 登录（记住我 7 天有效）
- JWT Token 认证，路由守卫自动拦截过期 Token
- 个人中心：行程统计、设置面板

### AI 行程规划

- 输入城市 + 天数 + 预算，一键生成完整行程
- 4 Agent 协作：搜索真实景点 → 查询天气 → 规划路线 → 审核优化 → 预算分解
- 每日行程包含上午/下午/晚间三段式安排
- 每个景点附带：建议时长、门票、交通方式、开放时间、周边美食、旅行贴士
- 规划师配备工具链：联网搜索景点详情、查询交通路线、推荐附近餐厅

### AI 旅行对话

- 多轮上下文记忆（服务端存储历史对话）
- SSE 流式输出，打字机效果
- AI 回复后自动生成建议追问

### 行程管理

- 历史行程列表（下拉刷新 + 分页搜索）
- 行程详情查看（每日景点卡片）
- 收藏功能

---

## 📊 项目指标

| 维度              | 数据                                               |
| ----------------- | -------------------------------------------------- |
| 前端源文件        | 33 个（7 页面 + 8 组件 + 5 Composables + 2 Store） |
| 后端源文件        | 40+ 个（3 路由 + 5 服务 + 7 Agent 节点 + 5 工具）  |
| TypeScript 覆盖率 | 100%（strict 模式，前后端统一）                    |
| 共享类型定义      | 15 个接口 / 类型 / 联合类型                        |
| 数据库模型        | 4 张表（User / Trip / TripDay / ChatMessage）      |
| 路由懒加载        | 7 条路由全部异步分包                               |
| 构建产物          | Gzip 预压缩 + Brotli 预压缩，零运行时 CPU 开销     |
