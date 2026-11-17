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
		<el-option-group
			v-for="group in groups"
			:key="group.id"
			:label="group.label"
		>
			<el-option
				v-for="candidate in group.items"
				:key="candidate.id"
				:value="candidate.id"
				:label="candidate.label"
				:disabled="candidate.eligible === false && !modelValue.includes(candidate.id)"
			/>
		</el-option-group>
	</el-select>
	<el-text size="small">{{ t('devicesVirtualPlugin.lightGroup.memberBounds') }}</el-text>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElOption, ElOptionGroup, ElSelect, ElText } from 'element-plus';

import { useVirtualWizardSourceGroups } from '../composables/use-virtual-wizard-placement';

const props = defineProps<{
	modelValue: string[];
	candidates: { id: string; label: string; eligible?: boolean; roomId?: string | null; zoneIds?: string[] }[];
	disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const { t } = useI18n();
const groupSources = useVirtualWizardSourceGroups();
const groups = computed(() => groupSources(props.candidates, (candidate) => candidate));
</script>
