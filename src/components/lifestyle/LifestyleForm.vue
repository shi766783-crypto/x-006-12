<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { LIFESTYLE_META } from '../../constants'
import { useFamilyStore } from '../../stores/useFamilyStore'
import type { LifestyleEntry, LifestyleType } from '../../types'
import { todayStr } from '../../utils/date'

const props = defineProps<{ memberId?: string }>()

const emit = defineEmits<{
  (e: 'save', data: Omit<LifestyleEntry, 'id' | 'timestamp'>): void
  (e: 'close'): void
}>()

const store = useFamilyStore()
const types = Object.keys(LIFESTYLE_META) as LifestyleType[]

const form = reactive({
  memberId: props.memberId ?? store.state.members[0]?.id ?? '',
  type: 'exercise' as LifestyleType,
  value: '',
  date: todayStr(),
})

const meta = computed(() => LIFESTYLE_META[form.type])
const error = ref('')

function submit() {
  const value = Number(form.value)
  if (!form.memberId) {
    error.value = '请选择成员'
    return
  }
  if (!form.date) {
    error.value = '请选择日期'
    return
  }
  if (!Number.isFinite(value) || value <= 0) {
    error.value = '请输入大于 0 的数值'
    return
  }
  if (value > meta.value.max) {
    error.value = `数值不能超过 ${meta.value.max} ${meta.value.unit}`
    return
  }
  emit('save', {
    memberId: form.memberId,
    type: form.type,
    value,
    date: form.date,
  })
}
</script>

<template>
  <div class="form-grid">
    <div class="form-group">
      <label class="form-label">成员</label>
      <select v-model="form.memberId" class="input">
        <option v-for="m in store.state.members" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">类型</label>
      <select v-model="form.type" class="input">
        <option v-for="t in types" :key="t" :value="t">
          {{ LIFESTYLE_META[t].icon }} {{ LIFESTYLE_META[t].label }}
        </option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">数值 ({{ meta.unit }})</label>
      <input
        v-model="form.value"
        type="number"
        min="0"
        :max="meta.max"
        :step="meta.step"
        class="input"
        :placeholder="`建议目标 ${meta.target} ${meta.unit}`"
      />
    </div>
    <div class="form-group">
      <label class="form-label">日期</label>
      <input v-model="form.date" type="date" class="input" :max="todayStr()" />
    </div>
    <div class="form-group span-2">
      <span class="merge-hint" :class="meta.mergeMode">
        {{ meta.icon }} {{ meta.label}}规则：{{ meta.mergeHint }}
      </span>
    </div>
    <div v-if="error" class="form-group span-2">
      <span class="form-error">{{ error }}</span>
    </div>
  </div>
  <div class="form-actions">
    <button type="button" class="btn btn-ghost" @click="emit('close')">取消</button>
    <button type="button" class="btn btn-primary" @click="submit">保存</button>
  </div>
</template>

<style scoped>
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.merge-hint {
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
}
.merge-hint.add {
  background: var(--accent-bg);
  color: var(--accent-color);
}
.merge-hint.overwrite {
  background: #fef5e7;
  color: #b9770e;
}
.form-error {
  font-size: 13px;
  color: var(--danger-color);
}
</style>
