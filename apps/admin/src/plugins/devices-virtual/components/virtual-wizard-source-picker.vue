<template>
	<div class="source-picker">
		<virtual-wizard-card
			v-if="selected.length"
			:plain="readOnly"
			flush
			icon="mdi:format-list-checks"
		>
			<template #header>
				<div class="source-picker__heading">
					<span>{{ selectedTitle ?? text('selectedSources') }}</span>
					<el-tag
						v-if="multiple"
						size="small"
						type="info"
					>
						{{ selected.length }}
					</el-tag>
				</div>
			</template>
			<el-table
				:data="selected"
				row-key="id"
				data-test-id="wizard-selected-sources"
			>
				<el-table-column
					fixed="left"
					:label="t('devicesVirtualPlugin.measurement.selectSource')"
					min-width="280"
				>
					<template #default="{ row }">
						<strong class="source-picker__name">{{ row.name }}</strong>
						<div>
							<el-text size="small">
								{{ row.detail }}
							</el-text>
						</div>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('devicesModule.fields.devices.room.title')"
					width="170"
					prop="room"
					show-overflow-tooltip
				/>
				<slot name="columns" />
				<el-table-column
					:label="text('currentValue')"
					width="95"
					prop="reading"
				>
					<template #default="{ row }">
						<span :title="row.readingHint">{{ row.reading }}</span>
					</template>
				</el-table-column>
				<el-table-column
					:label="text('lastReport')"
					width="100"
					prop="age"
					class-name="source-picker__age"
				/>
				<el-table-column
					v-if="readOnly && selected.some((source) => source.weight !== undefined)"
					:label="t('devicesVirtualPlugin.measurement.weight')"
					width="100"
					prop="weight"
				/>
				<el-table-column
					:label="text('state')"
					:width="readOnly ? 140 : 85"
				>
					<template #default="{ row }">
						<el-tag
							size="small"
							class="source-picker__state"
							:title="row.state?.label"
							:type="row.state?.type ?? (row.online === true ? 'success' : row.online === false ? 'warning' : 'info')"
						>
							{{ row.state?.label ?? (row.online === null ? '—' : text(row.online ? 'online' : 'offline')) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column
					v-if="!readOnly"
					fixed="right"
					width="60"
					align="right"
				>
					<template #default="{ row }">
						<virtual-wizard-remove-button
							:disabled="disabled"
							:label="t('devicesVirtualPlugin.measurement.remove')"
							@click="emit('remove', row.id)"
						/>
					</template>
				</el-table-column>
			</el-table>
		</virtual-wizard-card>
		<virtual-wizard-add-sources
			v-if="!readOnly"
			:sources="sources"
			:title="addTitle"
			:selected-ids="selected.map((source) => source.id)"
			:room-id="roomId"
			:zone-ids="zoneIds"
			:disabled="disabled"
			@add="emit('add', $event)"
		/>
	</div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElTable, ElTableColumn, ElTag, ElText } from 'element-plus';

import VirtualWizardAddSources from './virtual-wizard-add-sources.vue';
import VirtualWizardCard from './virtual-wizard-card.vue';
import VirtualWizardRemoveButton from './virtual-wizard-remove-button.vue';
import type { VirtualWizardSource } from './virtual-wizard-source-picker.types';

withDefaults(
	defineProps<{
		sources: VirtualWizardSource[];
		selected: VirtualWizardSource[];
		roomId?: string | null;
		roomName?: string;
		zoneIds?: string[];
		disabled?: boolean;
		readOnly?: boolean;
		multiple?: boolean;
		selectedTitle?: string;
		addTitle?: string;
	}>(),
	{ multiple: true, roomId: undefined, roomName: undefined, zoneIds: undefined, selectedTitle: undefined, addTitle: undefined }
);
const emit = defineEmits<{ add: [id: string]; remove: [id: string] }>();
const { t } = useI18n();
const text = (key: string, params = {}) => t(`devicesVirtualPlugin.wizard.layout.${key}`, params);
</script>
<style scoped>
.source-picker {
	container-type: inline-size;
	display: flex;
	flex-direction: column;
	gap: 24px;
	width: 100%;
	line-height: 20px;
}
.source-picker__heading {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	line-height: 20px;
}
.source-picker__name {
	display: block;
	overflow-wrap: anywhere;
	font-size: 14px;
	line-height: 20px;
}
.source-picker__detail {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	line-height: 18px;
}
.source-picker :deep(.source-picker__age .cell) {
	white-space: nowrap;
}
.source-picker__state {
	max-width: 100%;
}
.source-picker__state :deep(.el-tag__content) {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
