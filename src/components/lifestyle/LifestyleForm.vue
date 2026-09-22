<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { LIFESTYLE_METRICS, LIFESTYLE_METRIC_KEYS } from '../../constants'
import { useFamilyStore } from '../../stores/useFamilyStore'
import { formatDate, todayStr } from '../../utils/date'

const props = defineProps<{ memberId: string }>()
const emit = defineEmits<{
  (e: 'saved', overwritten: boolean): void
  (e: 'close'): void
}>()

const store = useFamilyStore()
const today = todayStr()

const form = reactive({
  date: today,
  exerciseMinutes: '',
  waterMl: '',
  sleepHours: '',
})

const existing = computed(() => store.getLifestyleEntry(props.memberId, form.date))

// Prefill when the date changes: existing date -> its values for editing,
// new date -> blank so a different day starts from scratch.
watch(
  [() => props.memberId, () => form.date],
  () => {
    const e = existing.value
    form.exerciseMinutes = e ? String(e.exerciseMinutes) : ''
    form.waterMl = e ? String(e.waterMl) : ''
    form.sleepHours = e ? String(e.sleepHours) : ''
  },
  { immediate: true },
)

function parse(key: (typeof LIFESTYLE_METRIC_KEYS)[number]): number | null {
  const raw = form[key].trim()
  if (raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

const errors = reactive<Record<string, string>>({})

const valid = computed(() =>
  LIFESTYLE_METRIC_KEYS.every((key) => {
    const n = parse(key)
    return n !== null
  }),
)

function validate(): boolean {
  for (const key of LIFESTYLE_METRIC_KEYS) {
    const raw = form[key].trim()
    const meta = LIFESTYLE_METRICS[key]
    if (raw === '') {
      errors[key] = `请填写${meta.label}`
    } else {
      const n = Number(raw)
      errors[key] =
        !Number.isFinite(n) || n < 0 ? '请输入不小于 0 的数字' : ''
    }
  }
  return LIFESTYLE_METRIC_KEYS.every((key) => !errors[key])
}

function submit() {
  if (!validate()) return
  const { overwritten } = store.saveLifestyleEntry({
    memberId: props.memberId,
    date: form.date,
    exerciseMinutes: parse('exerciseMinutes') ?? 0,
    waterMl: parse('waterMl') ?? 0,
    sleepHours: parse('sleepHours') ?? 0,
  })
  emit('saved', overwritten)
}
</script>

<template>
  <div>
    <!-- Overwrite rule banner: state the rule explicitly, every time -->
    <div class="rule-banner">
      <span class="rule-icon">📌</span>
      <span>
        每位成员每天只有一条记录：同一天再次保存将<strong>整体覆盖</strong>当天的运动、饮水、睡眠数值
        （不累加）。
      </span>
    </div>

    <div class="form-grid">
      <div class="form-group span-2">
        <label class="form-label">日期</label>
        <input v-model="form.date" type="date" class="input" :max="today" />
        <p v-if="form.date && form.date !== today" class="field-hint">
          记录日期：{{ formatDate(form.date) }}
        </p>
      </div>

      <div v-for="key in LIFESTYLE_METRIC_KEYS" :key="key" class="form-group">
        <label class="form-label">
          {{ LIFESTYLE_METRICS[key].icon }} {{ LIFESTYLE_METRICS[key].label }}
          （{{ LIFESTYLE_METRICS[key].unit }}）
        </label>
        <input
          v-model="form[key]"
          type="number"
          class="input"
          :min="LIFESTYLE_METRICS[key].min"
          :step="LIFESTYLE_METRICS[key].step"
          inputmode="decimal"
          :placeholder="`请输入${LIFESTYLE_METRICS[key].label}`"
        />
        <p v-if="errors[key]" class="field-error">{{ errors[key] }}</p>
        <p v-else class="field-hint">{{ LIFESTYLE_METRICS[key].reference }}</p>
      </div>
    </div>

    <div v-if="existing" class="overwrite-tip">
      ⚠️ {{ formatDate(form.date) }} 已有记录，保存后将用本次填写的数值替换原数值。
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn-ghost" @click="emit('close')">取消</button>
      <button type="button" class="btn btn-primary" :disabled="!valid" @click="submit">
        {{ existing ? '覆盖保存' : '保存' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.rule-banner {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  background: #fef5e7;
  border: 1px solid #f9e79f;
  color: #b9770e;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
}
.rule-icon {
  flex-shrink: 0;
}
.field-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}
.field-error {
  font-size: 12px;
  color: var(--danger-color);
  margin: 4px 0 0;
}
.overwrite-tip {
  margin-top: 4px;
  padding: 10px 12px;
  background: #fdecea;
  border: 1px solid #f5c6cb;
  color: #c0392b;
  border-radius: 10px;
  font-size: 13px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
