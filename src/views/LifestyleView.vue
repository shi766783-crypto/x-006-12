<script setup lang="ts">
import { computed, ref } from 'vue'
import LifestyleForm from '../components/lifestyle/LifestyleForm.vue'
import TrendChart from '../components/health/TrendChart.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import { LIFESTYLE_META } from '../constants'
import { useFamilyStore } from '../stores/useFamilyStore'
import type { LifestyleEntry, LifestyleType } from '../types'
import type { ChartPoint } from '../utils/chart'
import { formatDate, formatDateTime, lastNDates, todayStr } from '../utils/date'

const store = useFamilyStore()
const showForm = ref(false)
const selectedMember = ref(store.state.members[0]?.id ?? '')
const chartType = ref<LifestyleType>('exercise')

const types = Object.keys(LIFESTYLE_META) as LifestyleType[]
const today = todayStr()

const currentMemberId = computed(
  () => selectedMember.value || store.state.members[0]?.id || '',
)

const memberEntries = computed(() =>
  store.state.lifestyle
    .filter((l) => l.memberId === currentMemberId.value)
    .sort((a, b) => (a.date === b.date ? b.timestamp - a.timestamp : b.date.localeCompare(a.date))),
)

/** Daily total for a type. Sleep keeps at most one entry per day (overwrite rule). */
function dayTotal(date: string, type: LifestyleType): number {
  return memberEntries.value
    .filter((l) => l.date === date && l.type === type)
    .reduce((s, l) => s + l.value, 0)
}

/** Avoid float artifacts when accumulating (e.g. 7.5 + 0.5). */
function fmt(value: number): string {
  return String(Math.round(value * 10) / 10)
}

const weekDates = computed(() => lastNDates(7))

const chartPoints = computed<ChartPoint[]>(() =>
  weekDates.value.map((d) => ({ label: d.slice(5), value: dayTotal(d, chartType.value) })),
)

const chartMeta = computed(() => LIFESTYLE_META[chartType.value])

const history = computed(() => memberEntries.value.slice(0, 30))

function onSave(data: Omit<LifestyleEntry, 'id' | 'timestamp'>) {
  store.addLifestyle(data)
  if (data.memberId !== selectedMember.value) selectedMember.value = data.memberId
  if (chartType.value !== data.type) chartType.value = data.type
  showForm.value = false
}

function onDelete(entry: LifestyleEntry) {
  const meta = LIFESTYLE_META[entry.type]
  if (window.confirm(`确定删除 ${formatDate(entry.date)} 的${meta.label}记录吗？`)) {
    store.deleteLifestyle(entry.id)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">生活方式</h1>
      <button
        v-if="store.state.members.length"
        type="button"
        class="btn btn-primary"
        @click="showForm = true"
      >
        ＋ 记录生活方式
      </button>
    </div>

    <!-- Merge rules -->
    <section class="card rule-card">
      <strong class="rule-title">📌 同日重复提交规则</strong>
      <span v-for="t in types" :key="t" class="rule-item">
        {{ LIFESTYLE_META[t].icon }} {{ LIFESTYLE_META[t].label }}：{{ LIFESTYLE_META[t].mergeHint }}
      </span>
    </section>

    <template v-if="store.state.members.length">
      <!-- Member tabs -->
      <div class="member-tabs">
        <button
          v-for="m in store.state.members"
          :key="m.id"
          type="button"
          class="member-tab"
          :class="{ active: currentMemberId === m.id }"
          @click="selectedMember = m.id"
        >
          {{ m.name }}
        </button>
      </div>

      <!-- Today summary -->
      <section class="today-grid">
        <div v-for="t in types" :key="t" class="card today-card">
          <div class="today-head">
            <span class="today-label">{{ LIFESTYLE_META[t].icon }} {{ LIFESTYLE_META[t].label }}</span>
            <span class="merge-tag" :class="LIFESTYLE_META[t].mergeMode">
              {{ LIFESTYLE_META[t].mergeMode === 'add' ? '累加' : '覆盖' }}
            </span>
          </div>
          <div class="today-value">
            <span class="num" :style="{ color: LIFESTYLE_META[t].color }">
              {{ fmt(dayTotal(today, t)) }}
            </span>
            <span class="unit">/ {{ LIFESTYLE_META[t].target }} {{ LIFESTYLE_META[t].unit }}</span>
          </div>
          <div class="progress">
            <div
              class="progress-bar"
              :style="{
                width: Math.min(100, (dayTotal(today, t) / LIFESTYLE_META[t].target) * 100) + '%',
                background: LIFESTYLE_META[t].color,
              }"
            ></div>
          </div>
          <div class="today-note">
            {{ dayTotal(today, t) >= LIFESTYLE_META[t].target ? '✅ 已达标' : '今日目标 ' + LIFESTYLE_META[t].target + ' ' + LIFESTYLE_META[t].unit }}
          </div>
        </div>
      </section>

      <!-- 7-day trend -->
      <section class="card">
        <div class="section-head">
          <h3>近七天变化</h3>
          <select v-model="chartType" class="input inline-input">
            <option v-for="t in types" :key="t" :value="t">
              {{ LIFESTYLE_META[t].icon }} {{ LIFESTYLE_META[t].label }}
            </option>
          </select>
        </div>
        <TrendChart :points="chartPoints" :color="chartMeta.color" />
        <div class="chart-note">
          单位：{{ chartMeta.unit }} · 建议每日目标 {{ chartMeta.target }} {{ chartMeta.unit }}
        </div>
      </section>

      <!-- History -->
      <section class="card">
        <div class="section-head">
          <h3>记录明细</h3>
          <span class="muted">最近 {{ history.length }} 条</span>
        </div>
        <table v-if="history.length" class="table">
          <thead>
            <tr>
              <th>日期</th>
              <th>类型</th>
              <th>数值</th>
              <th>提交时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in history" :key="entry.id">
              <td>{{ formatDate(entry.date) }}</td>
              <td>{{ LIFESTYLE_META[entry.type].icon }} {{ LIFESTYLE_META[entry.type].label }}</td>
              <td>{{ fmt(entry.value) }} {{ LIFESTYLE_META[entry.type].unit }}</td>
              <td>{{ formatDateTime(entry.timestamp) }}</td>
              <td>
                <button type="button" class="icon-btn" @click="onDelete(entry)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-else icon="🌱" text="暂无生活方式记录" />
      </section>
    </template>
    <EmptyState v-else icon="👨‍👩‍👧‍👦" text="请先在「家庭成员」中添加成员" />

    <BaseModal v-if="showForm" title="记录生活方式" @close="showForm = false">
      <LifestyleForm :member-id="currentMemberId" @save="onSave" @close="showForm = false" />
    </BaseModal>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.page-title {
  margin: 0;
}
.rule-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  font-size: 13px;
  color: var(--text-secondary);
}
.rule-title {
  color: var(--text-primary);
}
.member-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.member-tab {
  padding: 8px 18px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.member-tab.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
  font-weight: 600;
}
.today-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.today-card {
  margin-bottom: 20px;
}
.today-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.today-label {
  font-weight: 600;
}
.merge-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}
.merge-tag.add {
  background: var(--accent-bg);
  color: var(--accent-color);
}
.merge-tag.overwrite {
  background: #fef5e7;
  color: #b9770e;
}
.today-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}
.today-value .num {
  font-size: 30px;
  font-weight: 800;
}
.today-value .unit {
  font-size: 13px;
  color: var(--text-secondary);
}
.progress {
  height: 8px;
  background: var(--bg-color);
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}
.today-note {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.section-head h3 {
  margin: 0;
}
.inline-input {
  width: auto;
}
.chart-note {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
}
.muted {
  color: var(--text-secondary);
  font-size: 13px;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table th,
.table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
}
.table th {
  color: var(--text-secondary);
  font-weight: 600;
}
.icon-btn {
  border: none;
  background: transparent;
  cursor: pointer;
}
</style>
