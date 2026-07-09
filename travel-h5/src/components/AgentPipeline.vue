<template>
  <div class="card agent-pipeline">
    <div class="section-title">
      Agent 协作进度
      <span class="elapsed-time" v-if="elapsedSeconds > 0">{{ formattedTime }}</span>
    </div>

    <!-- 管道步骤 -->
    <div class="pipeline">
      <div
        v-for="agent in agents"
        :key="agent.name"
        class="pipeline-step"
        :class="[`step-${agent.status}`]"
      >
        <!-- 步骤图标 -->
        <div class="step-icon">
          <!-- idle: 灰色圆圈 -->
          <div v-if="agent.status === 'idle'" class="icon-circle idle">
            <van-icon :name="agent.icon" size="16" color="#c8c9cc" />
          </div>
          <!-- running: 蓝色旋转 -->
          <div v-else-if="agent.status === 'running'" class="icon-circle running">
            <van-loading size="18" color="#1989fa" />
          </div>
          <!-- complete: 绿色对勾 -->
          <div v-else-if="agent.status === 'complete'" class="icon-circle complete">
            <van-icon name="success" size="18" color="#07c160" />
          </div>
          <!-- error: 红色叉号 -->
          <div v-else-if="agent.status === 'error'" class="icon-circle error">
            <van-icon name="cross" size="18" color="#ee0a24" />
          </div>
        </div>

        <!-- 步骤标签 -->
        <div class="step-label" :class="{ active: agent.status === 'running' }">
          {{ agent.label }}
        </div>

        <!-- 连接线（最后一个不显示） -->
        <div v-if="agent.name !== 'budgeter'" class="step-connector">
          <div class="connector-line" :class="{ filled: agent.status === 'complete' }"></div>
        </div>
      </div>
    </div>

    <!-- 所有 Agent 日志叠加显示 -->
    <div
      v-if="hasAnyMessage"
      class="agent-logs"
    >
      <div
        v-for="agent in agentsWithMessages"
        :key="agent.name"
        class="agent-log-item"
        :class="`log-${agent.status}`"
      >
        <div class="message-header">
          <span class="agent-name">
            <span class="status-dot" :class="`dot-${agent.status}`"></span>
            {{ AGENT_LABELS[agent.name] || agent.name }}
          </span>
          <span class="status-badge" :class="`badge-${agent.status}`">
            {{ STATUS_LABELS[agent.status] }}
          </span>
        </div>
        <div class="message-body">
          {{ agent.status === 'running' ? agent.message : agent.summary || agent.message }}
        </div>
        <div v-if="agent.status === 'error' && agent.error" class="message-error">
          ⚠️ {{ agent.error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import type { AgentStateInfo } from '../composables/useAgentStream'
import type { AgentName } from '@shared/types'

// ---- Props ----
const props = defineProps<{
  agents: AgentStateInfo[]
}>()

// ---- 计时器 ----
const elapsedSeconds = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

watch(
  () => props.agents,
  (agents) => {
    const hasRunning = agents.some((a) => a.status === 'running')
    const allDone = agents.every((a) => a.status === 'complete' || a.status === 'error')

    if (hasRunning && !timer) {
      timer = setInterval(() => { elapsedSeconds.value++ }, 1000)
    }

    if (allDone && timer) {
      clearInterval(timer)
      timer = null
    }
  },
  { deep: true }
)

const formattedTime = computed(() => {
  const m = Math.floor(elapsedSeconds.value / 60)
  const s = elapsedSeconds.value % 60
  if (m > 0) return `${m}分${s.toString().padStart(2, '0')}秒`
  return `${s}秒`
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// ---- 常量 ----
const AGENT_LABELS: Record<AgentName, string> = {
  researcher: '搜索景点',
  weather: '天气查询',
  planner: '行程规划',
  budgeter: '预算计算',
}

const STATUS_LABELS: Record<string, string> = {
  idle: '等待中',
  running: '执行中',
  complete: '已完成',
  error: '出错',
}

// ---- 计算属性 ----
/** 所有有消息需要展示的 Agent（叠加显示，不替换） */
const agentsWithMessages = computed<AgentStateInfo[]>(() => {
  return props.agents.filter(
    (a) => a.status !== 'idle' || a.message
  )
})

/** 是否有任何消息需要展示 */
const hasAnyMessage = computed<boolean>(() => {
  return agentsWithMessages.value.length > 0
})
</script>

<style scoped>
.agent-pipeline {
  margin-bottom: 16px;
  width: 95%;
}

.elapsed-time {
  font-size: var(--font-xs);
  font-weight: 400;
  color: var(--text-muted);
  margin-left: auto;
}

/* ---- 管道布局 ---- */
.pipeline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 0 8px;
  position: relative;
}

.pipeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex: 1;
}

.step-icon {
  margin-bottom: 8px;
  z-index: 999;
}

.icon-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.icon-circle.idle {
  background: #f5f5f5;
  border: 2px solid #ebedf0;
}

.icon-circle.running {
  background: #e6f7ff;
  border: 2px solid #1989fa;
  animation: pulse 1.5s infinite;
}

.icon-circle.complete {
  background: #f0fff4;
  border: 2px solid #07c160;
}

.icon-circle.error {
  background: #fff1f0;
  border: 2px solid #ee0a24;
}

.step-label {
  font-size: 12px;
  color: #999;
  text-align: center;
  transition: color 0.3s;
}

.step-label.active {
  color: #1989fa;
  font-weight: 600;
}

/* ---- 连接线 ---- */
.step-connector {
  position: absolute;
  top: 18px;
  left: 60%;
  width: 80%;
  z-index: 0;
}

.connector-line {
  height: 2px;
  background: #ebedf0;
  transition: background 0.3s;
  border-radius: 1px;
}

.connector-line.filled {
  background: #07c160;
}

/* ---- Agent 日志叠加列表 ---- */
.agent-logs {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-log-item {
  padding: 10px 12px;
  border-radius: 8px;
  border-left: 3px solid #1989fa;
  background: #f7f8fa;
  transition: all 0.3s ease;
}

.agent-log-item.log-running {
  border-left-color: #1989fa;
  background: #f0f7ff;
}

.agent-log-item.log-complete {
  border-left-color: #07c160;
  background: #f7f8fa;
}

.agent-log-item.log-error {
  border-left-color: #ee0a24;
  background: #fff8f8;
}

/* 状态小圆点 */
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.dot-idle {
  background: #c8c9cc;
}

.dot-running {
  background: #1989fa;
  animation: pulse-dot 1.5s infinite;
}

.dot-complete {
  background: #07c160;
}

.dot-error {
  background: #ee0a24;
}

.message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.agent-name {
  font-size: 13px;
  font-weight: 600;
  color: #323233;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.badge-idle {
  background: #f5f5f5;
  color: #999;
}

.badge-running {
  background: #e6f7ff;
  color: #1989fa;
}

.badge-complete {
  background: #f0fff4;
  color: #07c160;
}

.badge-error {
  background: #fff1f0;
  color: #ee0a24;
}

.message-body {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
  word-break: break-all;
}

.message-error {
  margin-top: 4px;
  font-size: 12px;
  color: #ee0a24;
}

/* ---- 动画 ---- */
@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(25, 137, 250, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(25, 137, 250, 0);
  }
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
