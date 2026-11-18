<template>
	<el-table
		:data="rows"
		row-key="id"
		:row-class-name="({ row }) => (row.controls ? 'group-matrix__controls' : '')"
		class="group-matrix"
		data-test-id="group-capability-matrix"
	>
		<el-table-column
			fixed="left"
			:min-width="280"
			:label="t('devicesVirtualPlugin.lightGroup.members')"
		>
			<template #default="{ row }">
				<strong>{{ row.controls ? text('groupControls') : row.name }}</strong>
				<el-text
					size="small"
					class="block"
				>
					{{ row.controls ? text('controlsHint') : `${row.detail} · ${row.room}` }}
				</el-text>
			</template>
		</el-table-column>
		<el-table-column
			v-for="category in columns"
			:key="category"
			:label="categoryLabel(category)"
			:width="120"
			align="center"
		>
			<template #default="{ row }">
				<el-checkbox
					v-if="row.controls"
					:model-value="selectedCapabilities.includes(category)"
					:aria-label="categoryLabel(category)"
					:disabled="disabled || requiredCapabilities.includes(category) || controlsDisabled || !availableCategories.has(category)"
					:data-capability="category"
					@update:model-value="emit('toggle', category, !!$event)"
				/>
				<el-text
					v-else
					:type="supports(row, category) ? 'success' : undefined"
				>
					{{ text(supports(row, category) ? 'yes' : 'no') }}
				</el-text>
			</template>
		</el-table-column>
		<el-table-column
			fixed="right"
			:width="60"
			align="right"
		>
			<template #default="{ row }">
				<virtual-wizard-remove-button
					v-if="!row.controls"
					:disabled="disabled"
					:data-remove-member="row.id"
					:label="t('devicesVirtualPlugin.measurement.remove')"
					@click="emit('remove', row.id)"
				/>
			</template>
		</el-table-column>
	</el-table>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCheckbox, ElTable, ElTableColumn, ElText } from 'element-plus';

import type { GroupCapability, GroupMemberOption } from '../utils/group-authoring.types';

import VirtualWizardRemoveButton from './virtual-wizard-remove-button.vue';

type Category = GroupCapability['category'];
const props = defineProps<{
	members: GroupMemberOption[];
	columns: Category[];
	availableCapabilities: GroupCapability[];
	selectedCapabilities: Category[];
	requiredCapabilities: Category[];
	disabled?: boolean;
	controlsDisabled?: boolean;
}>();
const emit = defineEmits<{ remove: [id: string]; toggle: [category: Category, selected: boolean] }>();
const { t } = useI18n();
const text = (key: string) => t(`devicesVirtualPlugin.lightGroup.wizard.${key}`);
const categoryLabel = (category: string) => t(`devicesModule.categories.channelsProperties.${category}`);
const availableCategories = computed(() => new Set(props.availableCapabilities.map((entry) => entry.category)));
const supports = (member: GroupMemberOption, category: Category) => member.capabilities.some((entry) => entry.category === category);
const rows = computed(() => [...props.members.map((member) => ({ ...member, controls: false })), { id: 'group-controls', controls: true }]);
</script>
<style scoped>
.group-matrix {
	width: 100%;
}
.group-matrix :deep(.cell) {
	line-height: 20px;
}
.group-matrix :deep(td.el-table__cell) {
	padding: 12px 0;
}
.group-matrix :deep(.group-matrix__controls) {
	--el-table-tr-bg-color: var(--el-fill-color-light);
}
</style>
