<template>
  <div class="chat-bubble" :class="messageClass">
    <!-- AI 头像 -->
    <!-- <div class="bubble-avatar" v-if="message.role === 'ai'">
      <div class="ai-avatar-icon">
        <van-icon name="service" size="20" color="#fff" />
      </div>
    </div> -->

    <!-- 气泡主体 -->
    <div class="bubble-body">
      <div class="bubble-content" :class="{ 'ai-content': message.role === 'ai' }">
        <!-- 用户消息：纯文本 -->
        <div class="message-text" v-if="message.role === 'user'">{{ message.content }}</div>

        <!-- AI 消息：Markdown 渲染 -->
        <div
          v-else-if="message.content"
          ref="markdownBodyRef"
          class="message-text markdown-body"
          v-html="displayedContent"
        ></div>

        <!-- AI 消息操作栏 -->
        <div class="message-actions" v-if="message.role === 'ai' && message.content">
          <button class="action-btn" @click="handleCopy" :class="{ copied }">
            <van-icon :name="copied ? 'success' : 'description'" size="14" />
            <span>{{ copied ? '已复制' : '复制' }}</span>
          </button>
        </div>
      </div>

      <!-- 时间 -->
      <div class="message-time" v-if="showTime">{{ formatTime }}</div>

      <!-- 重新生成链接 -->
      <div
        class="regenerate-link"
        v-if="message.role === 'ai' && message.content"
        @click="$emit('regenerate', message.id)"
      >
        <van-icon name="replay" size="13" />
        <span>重新生成</span>
      </div>
    </div>

    <!-- 用户头像 -->
    <!-- <div class="bubble-avatar" v-if="message.role === 'user'">
      <div class="user-avatar-icon">
        <van-icon name="user-o" size="20" color="#fff" />
      </div>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { showToast } from 'vant'
import { renderMarkdownSync, hydrateMathElements } from '../composables/useMarkdown'
import { useClipboard } from '../composables/useClipboard'

export interface ChatMessage {
  id: number
  role: 'user' | 'ai'
  content: string
  timestamp: string
}

const props = defineProps<{
  message: ChatMessage
}>()

defineEmits<{
  regenerate: [messageId: number]
}>()

const { copy } = useClipboard()
const copied = ref(false)

// CSS 类
const messageClass = computed(() =>
  props.message.role === 'user' ? 'user-message' : 'ai-message'
)

const showTime = computed(() =>
  !!(props.message.timestamp && props.message.content)
)

const formatTime = computed(() => {
  if (!props.message.timestamp) return ''
  const date = new Date(props.message.timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
})

// ============================================================
// rAF 帧对齐防抖策略
//
// 问题：SSE 流式场景下，chunk 到达频率不可控（同一帧内可能到达多个 chunk），
// 每次 content 变化 → computed 重算 → v-html 全量重解析 DOM，造成：
//   1. 每 chunk 触发一次完整的 markdown 解析 + DOM 重建
//   2. 浏览器在帧中间被迫执行昂贵的 innerHTML 赋值，掉帧
//
// 方案：用 requestAnimationFrame 将多 chunk 合并为单帧渲染。
//   - 内容变化时只记录"脏"标记，不立即渲染
//   - rAF 回调在浏览器 paint 之前执行，保证一帧最多一次 DOM 更新
//   - 多个 chunk 在同一 ~16ms 帧内到达 → 合并为一次 renderMarkdownSync + v-html
//   - 与 vsync 对齐，保障 60fps 无抖动
//
// 数据流：
//   SSE chunk → message.content 变化 → watch 触发 → 标记 dirty + 排期 rAF
//   → rAF 回调检查 dirty → renderMarkdownSync → displayedContent.value = html
//   → Vue 响应式更新 v-html（仅一次 DOM 操作，在 paint 前完成）
// ============================================================

const markdownBodyRef = ref<HTMLElement | null>(null)

// 帧对齐渲染：用 ref 替代 computed，手动控制 DOM 更新时机
const displayedContent = ref('')
let lastRenderedText = ''       // 上次渲染的原文，用于跳过无变化渲染
let dirty = false                // 脏标记：有新内容到达但尚未渲染
let rAFId: number | null = null  // 排期的 rAF，保证同时只存在一个

/** 排期一帧内的渲染：多次调用只注册一个 rAF */
function scheduleFrameRender(): void {
  dirty = true
  if (rAFId !== null) return       // 当前帧已排期，跳过
  rAFId = requestAnimationFrame(() => {
    rAFId = null
    if (!dirty) return              // 组件已卸载或无新内容
    dirty = false

    const currentText = props.message.content
    if (currentText === lastRenderedText) return  // 内容未变化，跳过 DOM 更新
    lastRenderedText = currentText

    // 在 rAF 内执行渲染 + DOM 更新，保证在浏览器 paint 之前完成
    displayedContent.value = renderMarkdownSync(currentText)

    // 渲染完成后，排期 KaTeX 数学公式 hydration（低优先级，延迟到流稳定后）
    scheduleMathHydration()
  })
}

// ---- KaTeX 数学公式延迟渲染（在内容停止变化 200ms 后执行）----
let mathHydrationTimer: ReturnType<typeof setTimeout> | null = null

function scheduleMathHydration(): void {
  if (mathHydrationTimer) clearTimeout(mathHydrationTimer)
  mathHydrationTimer = setTimeout(() => {
    if (markdownBodyRef.value) {
      hydrateMathElements(markdownBodyRef.value)
    }
  }, 200)
}

// 监听原始内容变化——只排期，不直接渲染
watch(
  () => props.message.content,
  () => {
    scheduleFrameRender()
  },
  { immediate: true }  // 首次挂载立即渲染
)

onMounted(() => {
  // 已通过 watch immediate 处理首次渲染
  if (props.message.content && !lastRenderedText) {
    scheduleFrameRender()
  }
})

onUnmounted(() => {
  if (rAFId !== null) {
    cancelAnimationFrame(rAFId)
    rAFId = null
  }
  if (mathHydrationTimer) {
    clearTimeout(mathHydrationTimer)
    mathHydrationTimer = null
  }
})

// 复制
async function handleCopy() {
  const ok = await copy(props.message.content)
  if (ok) {
    copied.value = true
    showToast({ message: '已复制', position: 'top', duration: 1500 })
    setTimeout(() => (copied.value = false), 2000)
  } else {
    showToast({ message: '复制失败', position: 'top', duration: 1500 })
  }
}
</script>

<style scoped>
/* ========== 布局 ========== */
.chat-bubble {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 4px 0;
}

.user-message {
  flex-direction: row-reverse;
}

.ai-message {
  flex-direction: row;
}

/* ========== 头像 ========== */
.bubble-avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
}

.ai-avatar-icon,
.user-avatar-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.user-message .bubble-avatar {
  background: var(--gradient-primary);
}

.ai-message .bubble-avatar {
  background: var(--gradient-purple);
}

/* ========== 气泡主体 ========== */
.bubble-body {
  display: flex;
  flex-direction: column;
  max-width: calc(100% - 75px);
}

.user-message .bubble-body {
  align-items: flex-end;
}

.ai-message .bubble-body {
  align-items: flex-start;
}

.bubble-content {
  padding: 12px 16px;
  border-radius: 18px;
  font-size: var(--font-md);
  line-height: 1.6;
  word-break: break-word;
  position: relative;
}

.user-message .bubble-content {
  background: var(--gradient-primary);
  color: #fff;
  border-bottom-right-radius: 6px;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
}

.ai-message .bubble-content {
  background: #fff;
  color: var(--text-primary);
  border-bottom-left-radius: 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

/* ========== Markdown 内容样式 ========== */

/* ---- 标题 ---- */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 8px 0 4px;
  line-height: 1.4;
}

.markdown-body :deep(h1) {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.markdown-body :deep(h2) {
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.markdown-body :deep(h3) {
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.markdown-body :deep(h4) {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-secondary);
}

/* ---- 段落 ---- */
.markdown-body :deep(p) {
  margin: 4px 0;
}

/* ---- 文本格式 ---- */
.markdown-body :deep(strong) {
  font-weight: 700;
  color: var(--text-primary);
}

.markdown-body :deep(em) {
  font-style: italic;
  color: var(--text-secondary);
}

/* ---- 行内代码 ---- */
.markdown-body :deep(code:not(pre code)) {
  background: rgba(14, 165, 233, 0.1);
  color: var(--primary-dark);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: var(--font-sm);
}

/* ---- 代码块（highlight.js）---- */
.markdown-body :deep(pre) {
  background: #1e293b;
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  overflow-x: auto;
  margin: 8px 0;
  line-height: 1.6;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: var(--font-sm);
  color: #e2e8f0;
  white-space: pre;
  word-wrap: normal;
}

/* ---- 链接 ---- */
.markdown-body :deep(a) {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-body :deep(a:hover) {
  color: var(--primary-dark);
}

/* ---- 列表 ---- */
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}

.markdown-body :deep(li) {
  margin: 2px 0;
  font-size: var(--font-sm);
  line-height: 1.6;
}

.markdown-body :deep(ul > li) {
  list-style-type: disc;
}

.markdown-body :deep(ol > li) {
  list-style-type: decimal;
}

/* ---- 引用块 ---- */
.markdown-body :deep(blockquote) {
  border-left: 4px solid var(--primary);
  padding: 4px 12px;
  margin: 8px 0;
  color: var(--text-secondary);
  background: rgba(14, 165, 233, 0.04);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.markdown-body :deep(blockquote p) {
  margin: 2px 0;
}

/* ---- 表格 ---- */
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: var(--font-sm);
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 6px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f1f5f9;
  font-weight: 600;
  color: var(--text-primary);
}

.markdown-body :deep(tr:nth-child(even) td) {
  background: #f8fafc;
}

/* ---- 分割线 ---- */
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 12px 0;
}

/* ---- 图片 ---- */
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-sm);
  margin: 4px 0;
}

/* ---- KaTeX 数学公式 ---- */
.markdown-body :deep(.katex-display) {
  margin: 12px 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.markdown-body :deep(.katex) {
  font-size: 1.1em;
}

.markdown-body :deep(.math-block),
.markdown-body :deep(.math-inline) {
  display: inline;
}

.markdown-body :deep(.math-block) {
  display: block;
}

.markdown-body :deep(.math-block code),
.markdown-body :deep(.math-inline code) {
  background: rgba(139, 92, 246, 0.08);
  color: #7c3aed;
  font-style: italic;
}

/* ========== 消息操作栏 ========== */
.message-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(14, 165, 233, 0.06);
  color: var(--primary);
}

.action-btn:active {
  background: rgba(14, 165, 233, 0.12);
}

.action-btn.copied {
  color: var(--success);
}

/* ========== 时间 ========== */
.message-time {
  display: inline-block;
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-top: 4px;
  padding: 0 8px;
}

/* ========== 重新生成 ========== */
.regenerate-link {
  /* display: inline-flex; */
  display: inline-block;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 2px 8px;
  font-size: var(--font-xs);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s;
  user-select: none;
}

.regenerate-link:hover {
  color: var(--primary);
}

.regenerate-link:active {
  opacity: 0.7;
}
</style>
