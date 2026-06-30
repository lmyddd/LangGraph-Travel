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
          class="message-text markdown-body"
          v-html="renderedContent"
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
import { computed, ref } from 'vue'
import { showToast } from 'vant'
import { renderMarkdown } from '../composables/useMarkdown'
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

// Markdown 渲染
const renderedContent = computed(() => renderMarkdown(props.message.content))

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
.markdown-body :deep(.md-h3) {
  font-size: var(--font-lg);
  font-weight: 700;
  margin: 8px 0 4px;
  color: var(--text-primary);
}

.markdown-body :deep(.md-h4) {
  font-size: var(--font-md);
  font-weight: 600;
  margin: 6px 0 3px;
  color: var(--text-secondary);
}

.markdown-body :deep(strong) {
  font-weight: 700;
  color: var(--text-primary);
}

.markdown-body :deep(em) {
  font-style: italic;
  color: var(--text-secondary);
}

.markdown-body :deep(.inline-code) {
  background: rgba(14, 165, 233, 0.1);
  color: var(--primary-dark);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: var(--font-sm);
}

.markdown-body :deep(.md-link) {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-body :deep(.md-ul),
.markdown-body :deep(.md-ol) {
  margin: 4px 0;
  padding-left: 20px;
}

.markdown-body :deep(.md-li) {
  list-style-type: disc;
  margin: 2px 0;
  font-size: var(--font-sm);
  line-height: 1.6;
}

.markdown-body :deep(.md-li-ordered) {
  margin: 2px 0;
  font-size: var(--font-sm);
  line-height: 1.6;
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
