<template>
	<section class="source-picker">
		<div class="source-picker__toolbar">
			<h4 class="source-picker__heading source-picker__heading--toolbar">{{ title ?? text('addSource') }}</h4>
			<div class="source-picker__search">
				<el-input
					v-model="search"
					:aria-label="text('searchSources')"
					clearable
					:placeholder="text('searchSources')"
				/>
			</div>
		</div>
		<virtual-wizard-card
			v-for="group in groups"
			:key="group.id"
			icon="mdi:devices"
			shadow="never"
			body-class="p-0!"
			:data-source-group="group.id"
			class="source-picker__group"
		>
			<template #header>
				<strong class="source-picker__group-heading">{{ group.label }}</strong>
			</template>
			<div class="source-list">
				<div
					v-for="source in pageSources(group.id, group.sources)"
					:key="source.id"
					class="source-list__row"
				>
					<div class="min-w-0 grow">
						<strong class="source-picker__name">{{ source.name }}</strong>
						<div
							class="source-picker__detail"
							:title="`${source.detail} · ${source.room}`"
						>
							<el-text size="small">{{ source.detail }} · {{ source.room }}</el-text>
						</div>
						<el-text
							v-if="source.disabledReason"
							size="small"
							class="source-picker__reason"
						>
							{{ source.disabledReason }}
						</el-text>
					</div>
					<el-tag
						v-if="source.badge"
						:type="source.badge.type"
						size="small"
					>
						{{ source.badge.label }}
					</el-tag>
					<el-text
						v-else-if="source.reading"
						class="source-picker__reading"
						:title="source.readingHint"
					>
						{{ source.reading }}
					</el-text>
					<el-button
						size="small"
						:disabled="disabled || source.disabled"
						:data-source-id="source.id"
						@click="emit('add', source.id)"
					>
						{{ text('add') }}
					</el-button>
				</div>
			</div>
			<el-pagination
				v-if="group.sources.length > pageSize"
				:current-page="pageFor(group.id, group.sources.length)"
				:page-size="pageSize"
				:total="group.sources.length"
				layout="prev, pager, next"
				small
				class="source-picker__pagination"
				@update:current-page="pages[group.id] = $event"
			/>
		</virtual-wizard-card>
		<el-text v-if="!groups.length">
			{{ text('noSources') }}
		</el-text>
	</section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElInput, ElPagination, ElTag, ElText } from 'element-plus';

import { useVirtualWizardSourceGroups } from '../composables/use-virtual-wizard-placement';

import type { VirtualWizardSourceOption } from './virtual-wizard-add-sources.types';
import VirtualWizardCard from './virtual-wizard-card.vue';

const props = withDefaults(
	defineProps<{
		sources: VirtualWizardSourceOption[];
		selectedIds: string[];
		title?: string;
		roomId?: string | null;
		zoneIds?: string[];
		disabled?: boolean;
	}>(),
	{ title: undefined, roomId: undefined, zoneIds: undefined }
);
const emit = defineEmits<{ add: [id: string] }>();
const { t } = useI18n();
const text = (key: string, params = {}) => t(`devicesVirtualPlugin.wizard.layout.${key}`, params);
const search = ref('');
// Bound component/DOM cost independently of catalogue size. Search still covers every source.
const pageSize = 20;
const pages = ref<Record<string, number>>({});
const pageFor = (id: string, count: number) => Math.max(1, Math.min(pages.value[id] ?? 1, Math.ceil(count / pageSize)));
const pageSources = (id: string, sources: VirtualWizardSourceOption[]) => {
	const start = (pageFor(id, sources.length) - 1) * pageSize;
	return sources.slice(start, start + pageSize);
};
watch([search, () => props.roomId, () => props.zoneIds], () => {
	pages.value = {};
});
const normalize = (value: string) =>
	value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase();
const groupSources = useVirtualWizardSourceGroups();
const query = computed(() => normalize(search.value.trim()));
const groups = computed(() => {
	const chosen = new Set(props.selectedIds);
	const available = props.sources.filter(
		(source) => !chosen.has(source.id) && normalize(`${source.name} ${source.detail} ${source.room}`).includes(query.value)
	);
	return groupSources(available, (source) => source, { roomId: props.roomId, zoneIds: props.zoneIds }).map((group) => ({
		...group,
		sources: group.items,
	}));
});
</script>
<style scoped>
.source-picker {
	container-type: inline-size;
	width: 100%;
	line-height: 20px;
}
.source-picker__heading {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0 0 8px;
	font-size: 14px;
	font-weight: 600;
	line-height: 20px;
}
.source-picker__heading--toolbar {
	margin: 0;
}
.source-picker__toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 12px;
}
.source-picker__search {
	width: 340px;
	max-width: 100%;
}
.source-picker__group + .source-picker__group {
	margin-top: 12px;
}
.source-picker__pagination {
	justify-content: flex-end;
	padding: 12px;
	border-top: 1px solid var(--el-border-color-lighter);
}
.source-picker__group-heading {
	display: block;
	font-weight: 600;
	line-height: 18px;
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
.source-picker__reading {
	white-space: nowrap;
}
.source-list__row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto auto;
	align-items: center;
	gap: 12px;
	padding: 10px 12px;
}
.source-list__row + .source-list__row {
	border-top: 1px solid var(--el-border-color-lighter);
}
@container (max-width: 480px) {
	.source-picker__search {
		width: 100%;
	}
	.source-list__row {
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 6px 12px;
	}
	.source-list__row > :first-child {
		grid-column: 1 / -1;
	}
}

.source-picker__reason {
	display: block;
	margin-top: 4px;
}
</style>
