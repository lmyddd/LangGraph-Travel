<template>
  <div class="page-container chat-page">
    <!-- 导航栏 -->
    <div class="page-header">
      <van-nav-bar left-text="返回" fixed title="AI 旅游助手" left-arrow @click-left="goBack" />
    </div>

    <!-- 对话区 -->
    <div class="chat-container" ref="chatContainerRef">
      <!-- 空状态 -->
      <div v-if="messages.length === 0" class="chat-empty fade-in-up">
        <div class="empty-illustration">
          <div class="empty-icon-wrapper">
            <van-icon name="chat-o" size="40" class="empty-icon" />
          </div>
          <h3 class="empty-title">开始和 AI 助手对话吧！</h3>
          <p class="empty-desc">我是你的专属旅行顾问，随时为你解答旅行疑问</p>
        </div>
        <div class="quick-questions">
          <div class="quick-title">💡 试试这些问题</div>
          <div class="quick-tags">
            <van-tag
              v-for="(item, index) in quickQuestions"
              :key="index"
              class="quick-tag"
              size="large"
              mark
              @click="sendMessage(item)"
            >
              {{ item }}
            </van-tag>
          </div>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-else class="messages-list">
        <ChatBubble
          v-for="msg in messages"
          :key="msg.id"
          :message="msg"
          @regenerate="handleRegenerate"
        />

        <!-- 追问标签（在最后一条AI消息后） -->
        <div
          class="follow-up-chips"
          v-if="lastAiMessageContent && !isStreaming && suggestedQuestions.length > 0"
        >
          <span class="follow-up-hint">你可能还想问：</span>
          <van-tag
            v-for="(q, i) in suggestedQuestions"
            :key="i"
            class="follow-up-tag"
            size="medium"
            @click="sendMessage(q)"
          >
            {{ q }}
          </van-tag>
        </div>

        <!-- 流式响应指示器 -->
        <div class="streaming-indicator" v-if="isStreaming">
          <div class="typing-dots">
            <span></span><span></span><span></span>
          </div>
          <span>AI 正在思考中...</span>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="chat-input-area">
      <div class="input-row">
        <!-- 语音按钮 -->
        <button class="input-action-btn" @click="showToast('语音功能开发中')">
          <van-icon name="audio" size="22" />
        </button>

        <!-- 输入框 -->
        <div class="input-wrapper">
          <van-field
            v-model="inputMessage"
            placeholder="请输入您的问题..."
            @keyup.enter="sendMessage()"
            :disabled="isStreaming"
            class="chat-input"
            :border="false"
          />
        </div>

        <!-- 附件按钮 -->
        <button class="input-action-btn" @click="showToast('附件功能开发中')">
          <van-icon name="add-o" size="22" />
        </button>

        <!-- 发送按钮 -->
        <button
          class="send-btn"
          :disabled="!inputMessage.trim() || isStreaming"
          @click="sendMessage()"
        >
          <van-icon name="arrow-up" size="20" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatBubble from '../../components/ChatBubble.vue'
import type { ChatMessage } from '../../components/ChatBubble.vue'
import { useRouter, useRoute } from 'vue-router'
import { ref, onMounted, nextTick, computed } from 'vue'
import { fetchStream } from '../../utils/request'
import { showToast } from 'vant'
import { getSuggestions } from '../../composables/useSuggestedQuestions'

const chatContainerRef = ref<HTMLElement | null>(null)

const scrollToBottom = async (): Promise<void> => {
  await nextTick()
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
  }
}

const router = useRouter()

// 常见问题
const quickQuestions = ref<string[]>([
  '北京有哪些必去的景点？',
  '上海美食推荐',
  '成都三日游攻略',
  '如何选择旅行保险？'
])

// 对话内容
const messages = ref<ChatMessage[]>([])
const inputMessage = ref<string>('')
const isStreaming = ref<boolean>(false)

// 追问
const suggestedQuestions = ref<string[]>([])

const lastAiMessageContent = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'ai' && messages.value[i].content) {
      return messages.value[i].content
    }
  }
  return ''
})

// 发送消息
const sendMessage = (tagMsg?: string): void => {
  const msg = typeof tagMsg === 'string' ? tagMsg : inputMessage.value.trim()
  if (!msg || isStreaming.value) return
  addUserMessage(msg)
  scrollToBottom()
  inputMessage.value = ''
  suggestedQuestions.value = []
  getAiResponse(msg)
}

// AI 流式响应
const getAiResponse = (userMsg: string): void => {
  isStreaming.value = true
  messages.value.push({
    id: Date.now(),
    role: 'ai',
    content: '',
    timestamp: new Date().toISOString()
  })
  let fullResponse = ''
  fetchStream('chat', { message: userMsg }, (chunk: string) => {
    fullResponse += chunk
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.role === 'ai') {
      lastMsg.content = fullResponse
    }
    scrollToBottom()
  }, () => {
    isStreaming.value = false
    // 生成追问建议
    suggestedQuestions.value = getSuggestions(fullResponse, 3)
    scrollToBottom()
  }, (errorMsg: string) => {
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.role === 'ai') {
      lastMsg.content = `抱歉，AI发生错误：${errorMsg}`
    }
    isStreaming.value = false
    showToast(errorMsg)
    scrollToBottom()
  })
}

// 重新生成
const handleRegenerate = (messageId: number) => {
  // 找到这条 AI 消息对应的用户消息
  const idx = messages.value.findIndex((m) => m.id === messageId)
  if (idx <= 0) return
  const userMsg = messages.value[idx - 1]
  if (userMsg?.role !== 'user') return

  // 删除当前 AI 消息
  messages.value.splice(idx, 1)
  // 重新生成
  getAiResponse(userMsg.content)
}

const goBack = (): void => {
  router.back()
}

const addUserMessage = (content: string): void => {
  messages.value.push({
    id: Date.now(),
    role: 'user',
    content,
    timestamp: new Date().toISOString()
  })
}

const route = useRoute()
onMounted(() => {
  if (route.query.city) {
    inputMessage.value = `我想了解一下${route.query.city}的旅游信息`
  }
})
</script>

<style scoped>
.page-header {
  height: 46px;
}

.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  padding-bottom: 0px !important;
  background: var(--bg);
}

.chat-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 100px;
  scroll-behavior: smooth;
}

/* ========== 空状态 ========== */
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
}

.empty-illustration {
  text-align: center;
  margin-bottom: 40px;
}

.empty-icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(56, 189, 248, 0.12));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.empty-icon {
  color: #0EA5E9;
}

.empty-title {
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.empty-desc {
  font-size: var(--font-sm);
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

.quick-questions {
  width: 100%;
  max-width: 340px;
  text-align: center;
}

.quick-title {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.quick-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.quick-tag {
  cursor: pointer !important;
  padding: 8px 16px !important;
  font-size: var(--font-sm) !important;
  border-radius: 20px !important;
  background: #fff !important;
  color: var(--text-primary) !important;
  border: 1.5px solid #e2e8f0 !important;
  transition: all 0.3s ease !important;
}

.quick-tag:hover {
  border-color: #0EA5E9 !important;
  color: #0EA5E9 !important;
  background: #f0f9ff !important;
  transform: translateY(-1px);
}

.quick-tag:active {
  transform: scale(0.95);
}

/* ========== 消息列表 ========== */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ========== 追问标签 ========== */
.follow-up-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 0 8px;
  animation: fadeInUp 0.4s ease;
}

.follow-up-hint {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-right: 4px;
}

.follow-up-tag {
  cursor: pointer !important;
  background: #fff !important;
  color: var(--primary) !important;
  border: 1px solid rgba(14, 165, 233, 0.3) !important;
  border-radius: 16px !important;
  padding: 4px 12px !important;
  font-size: var(--font-xs) !important;
  transition: all 0.2s ease !important;
}

.follow-up-tag:hover {
  background: #f0f9ff !important;
  border-color: var(--primary) !important;
}

.follow-up-tag:active {
  transform: scale(0.95);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ========== 流式响应指示器 ========== */
.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  color: var(--text-muted);
  font-size: var(--font-sm);
  background: #fff;
  border-radius: 16px;
  border-bottom-left-radius: 6px;
  width: fit-content;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.typing-dots {
  display: flex;
  gap: 4px;
  align-items: center;
}

.typing-dots span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0EA5E9;
  animation: typingBounce 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) { animation-delay: 0s; }
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typingBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* ========== 输入区 ========== */
.chat-input-area {
  position: fixed;
  bottom: 50px;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  padding: 8px 12px;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.06);
  max-width: 750px;
  margin: 0 auto;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.input-action-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  touch-action: manipulation;
}

.input-action-btn:active {
  background: rgba(14, 165, 233, 0.08);
  color: var(--primary);
}

.input-wrapper {
  flex: 1;
  background: #f1f5f9;
  border-radius: 24px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.input-wrapper:focus-within {
  border-color: #0EA5E9;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.06);
}

.chat-input {
  background: transparent !important;
  border-radius: 24px;
  padding: 4px 14px !important;
}

.chat-input :deep(.van-field__control) {
  font-size: var(--font-md);
}

.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: #fff;
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
  touch-action: manipulation;
}

.send-btn:active {
  transform: scale(0.9);
}

.send-btn:disabled {
  background: #cbd5e1 !important;
  box-shadow: none !important;
  cursor: not-allowed;
}
</style>
