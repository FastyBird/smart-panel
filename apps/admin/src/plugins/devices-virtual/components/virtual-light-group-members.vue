<template>
	<el-select
		:model-value="modelValue"
		:disabled="disabled"
		multiple
		filterable
		:multiple-limit="256"
		class="w-full"
		:placeholder="t('devicesVirtualPlugin.lightGroup.selectMembers')"
		data-test-id="light-group-members"
		@update:model-value="emit('update:modelValue', $event)"
	>
		<el-option
			v-for="candidate in candidates"
			:key="candidate.id"
			:value="candidate.id"
			:label="candidate.label"
		/>
	</el-select>
	<el-text size="small">{{ t('devicesVirtualPlugin.lightGroup.memberBounds') }}</el-text>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElOption, ElSelect, ElText } from 'element-plus';

defineProps<{ modelValue: string[]; candidates: { id: string; label: string }[]; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const { t } = useI18n();
</script>
