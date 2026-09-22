<script setup lang="ts">
import { computed, ref } from 'vue'
import LifestyleForm from '../components/lifestyle/LifestyleForm.vue'
import TrendChart from '../components/health/TrendChart.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import { LIFESTYLE_METRICS, LIFESTYLE_METRIC_KEYS } from '../constants'
import { useFamilyStore } from '../stores/useFamilyStore'
import type { LifestyleMetricKey } from '../constants'
import type { ChartPoint } from '../utils/chart'
import { formatDate, lastNDates, todayStr } from '../utils/date'

const store = useFamilyStore()

const members = computed(() => store.state.members)
const selectedId = ref<string>('')

// Fall back to the first member when none selected or the selected one is gone.
const activeId = computed(
  () =>
    (members.value.some((m) => m.id === selectedId.value)
      ? selectedId.value
      : members.value[0]?.id) ?? '',
)

function selectMember(id: string) {
  selectedId.value = id
}

const showForm = ref(false)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function onSaved(overwritten: boolean) {
  showForm.value = false
  toast.value = overwritten ? '已覆盖当天的生活方式记录' : '生活方式记录已保存'
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2600)
}

const today = todayStr()
const week = computed(() =>
  activeId.value ? store.lifestyleLast7(activeId.value) : [],
)
const history = computed(() =>
  activeId.value ? store.lifestyleHistory(activeId.value) : [],
)
const todayEntry = computed(() =>
  week.value.find((e) => e?.date === today) ?? undefined,
)
const latestEntry = computed(() => history.value[0])

function shortLabel(date: string): string {
  return date.slice(5).replace('-', '/')
}

const weekDates = lastNDates(7)

function chartPoints(key: LifestyleMetricKey): ChartPoint[] {
  // week is always the same 7 consecutive dates, oldest first.
  return week.value.map((e, i) => ({
    label: shortLabel(weekDates[i]),
    value: e ? e[key] : null,
  }))
}

interface AvgStat {
  key: LifestyleMetricKey
  avg: number | null
  days: number
}

const weeklyAvg = computed<AvgStat[]>(() =>
  LIFESTYLE_METRIC_KEYS.map((key) => {
    const values = week.value.map((e) => (e ? e[key] : null))
    const recorded = values.filter((v): v is number => v !== null)
    return {
      key,
      days: recorded.length,
      avg: recorded.length
        ? recorded.reduce((s, v) => s + v, 0) / recorded.length
        : null,
    }
  }),
)

function displayValue(v: number | undefined | null): string {
  return v === undefined || v === null ? '—' : String(v)
}

function formatAvg(v: number | null): string {
  return v === null ? '—' : v.toFixed(1)
}

function onDelete(id: string, date: string) {
  if (window.confirm(`确定删除 ${formatDate(date)} 的生活方式记录吗？`)) {
    store.deleteLifestyleEntry(id)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">生活方式</h1>
      <button
        v-if="members.length"
        type="button"
        class="btn btn-primary"
        @click="showForm = true"
      >
        ＋ 记录今天
      </button>
    </div>

    <EmptyState
      v-if="!members.length"
      icon="🏃"
      text="还没有家庭成员，请先在「家庭成员」中建档后再记录生活方式"
    />

    <template v-else>
      <!-- Member switcher -->
      <div class="member-tabs">
        <button
          v-for="m in members"
          :key="m.id"
          type="button"
          class="member-tab"
          :class="{ active: m.id === activeId }"
          @click="selectMember(m.id)"
        >
          {{ m.name }}
        </button>
      </div>

      <!-- Rule reminder -->
      <div class="rule-line">
        📌 记录规则：每位成员每天仅保留一条记录，同一天重复提交按<strong>覆盖</strong>处理
        （以最后一次填写的运动、饮水、睡眠数值整体替换，不做累加）。
      </div>

      <!-- Today summary -->
      <section class="card">
        <div class="section-head">
          <h3>今日概览 · {{ formatDate(today) }}</h3>
          <span v-if="!todayEntry" class="muted">今天还未记录</span>
        </div>
        <div class="today-grid">
          <div v-for="key in LIFESTYLE_METRIC_KEYS" :key="key" class="today-item">
            <span class="today-icon">{{ LIFESTYLE_METRICS[key].icon }}</span>
            <div>
              <div class="today-label">{{ LIFESTYLE_METRICS[key].label }}</div>
              <div class="today-value">
                {{ displayValue(todayEntry?.[key]) }}
                <span class="today-unit">{{ LIFESTYLE_METRICS[key].unit }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!todayEntry && latestEntry" class="latest-note">
          最近一次记录：{{ formatDate(latestEntry.date) }}
        </div>
      </section>

      <!-- Last 7 days trends -->
      <section class="card">
        <div class="section-head">
          <h3>近 7 天变化</h3>
          <span class="muted">空白日期表示当天没有记录，曲线在该处断开</span>
        </div>
        <div class="chart-grid">
          <div v-for="key in LIFESTYLE_METRIC_KEYS" :key="key" class="chart-box">
            <div class="chart-title">
              <span>{{ LIFESTYLE_METRICS[key].icon }} {{ LIFESTYLE_METRICS[key].label }}</span>
              <span class="chart-avg">
                近 7 天均值
                {{ formatAvg(weeklyAvg.find((a) => a.key === key)?.avg ?? null) }}
                {{ LIFESTYLE_METRICS[key].unit }}
                <em>· {{ weeklyAvg.find((a) => a.key === key)?.days }}/7 天</em>
              </span>
            </div>
            <TrendChart :points="chartPoints(key)" :color="LIFESTYLE_METRICS[key].color" />
          </div>
        </div>
      </section>

      <!-- History -->
      <section class="card">
        <div class="section-head">
          <h3>历史记录</h3>
          <span class="muted">共 {{ history.length }} 天</span>
        </div>
        <div v-if="history.length" class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>日期</th>
                <th v-for="key in LIFESTYLE_METRIC_KEYS" :key="key">
                  {{ LIFESTYLE_METRICS[key].icon }} {{ LIFESTYLE_METRICS[key].label }}
                  （{{ LIFESTYLE_METRICS[key].unit }}）
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in history" :key="e.id" :class="{ 'row-today': e.date === today }">
                <td>
                  {{ formatDate(e.date) }}
                  <span v-if="e.date === today" class="today-tag">今天</span>
                </td>
                <td>{{ e.exerciseMinutes }}</td>
                <td>{{ e.waterMl }}</td>
                <td>{{ e.sleepHours }}</td>
                <td>
                  <button type="button" class="icon-btn" title="删除" @click="onDelete(e.id, e.date)">
                    🗑️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-else icon="🌿" text="暂无生活方式记录，点击右上角开始记录" />
      </section>
    </template>

    <BaseModal v-if="showForm" title="记录生活方式" @close="showForm = false">
      <LifestyleForm
        v-if="activeId"
        :member-id="activeId"
        @saved="onSaved"
        @close="showForm = false"
      />
    </BaseModal>

    <transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title {
  margin: 0;
}
.member-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.member-tab {
  padding: 7px 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: #fff;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.member-tab.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
  font-weight: 600;
}
.rule-line {
  background: var(--accent-bg, rgba(66, 185, 131, 0.1));
  border: 1px solid rgba(66, 185, 131, 0.25);
  color: #1e7e56;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}
.section-head h3 {
  margin: 0;
}
.muted {
  color: var(--text-secondary);
  font-size: 13px;
}
.today-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.today-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-color);
  border-radius: 12px;
  padding: 14px 16px;
}
.today-icon {
  font-size: 26px;
}
.today-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.today-value {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
}
.today-unit {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
}
.latest-note {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-secondary);
}
.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}
.chart-box {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px;
}
.chart-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 14px;
  flex-wrap: wrap;
}
.chart-avg {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary);
}
.chart-avg em {
  font-style: normal;
  color: #9ca3af;
}
.table-wrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table th,
.table td {
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}
.table th {
  color: var(--text-secondary);
  font-weight: 600;
}
.row-today {
  background: var(--accent-bg, rgba(66, 185, 131, 0.08));
}
.today-tag {
  display: inline-block;
  margin-left: 6px;
  background: var(--accent-color);
  color: #fff;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
}
.icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  background: rgba(31, 41, 55, 0.92);
  color: #fff;
  padding: 10px 20px;
  border-radius: 22px;
  font-size: 14px;
  z-index: 2000;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
