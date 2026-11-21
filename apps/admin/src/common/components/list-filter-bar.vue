<template>
	<div data-test-id="list-filter-bar">
		<div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-b-solid border-light">
			<el-input
				:model-value="props.search ?? ''"
				:placeholder="props.searchPlaceholder ?? t('application.listFilterBar.search')"
				:aria-label="props.searchPlaceholder ?? t('application.listFilterBar.search')"
				class="flex-[1_1_240px] max-w-[320px]"
				clearable
				data-test-id="list-filter-bar-search"
				@update:model-value="onSearch"
			>
				<template #prefix>
					<icon
						icon="mdi:magnify"
						aria-hidden="true"
					/>
				</template>
			</el-input>

			<template v-if="isDesktop">
				<div
					v-for="filter in quickFilters"
					:key="filter.id"
					:class="[
						'flex items-center rounded-[var(--el-border-radius-base)] border border-solid',
						isActive(filter) ? 'border-primary-soft bg-primary-soft' : 'border-default',
					]"
					:data-filter-id="filter.id"
					data-test-id="list-filter-bar-quick-filter"
				>
					<el-dropdown
						trigger="click"
						@command="(value: string) => emit('quick-filter', filter.id, value === '' ? null : value)"
					>
						<button
							:class="[
								'flex items-center gap-1.5 h-[var(--el-component-size)] px-3 border-0 bg-transparent rounded-[var(--el-border-radius-base)] font-inherit text-[14px] cursor-pointer',
								isActive(filter) ? 'text-primary' : 'text-regular',
							]"
							type="button"
							data-test-id="list-filter-bar-quick-filter-trigger"
						>
							{{ t('application.listFilterBar.quickFilter', { label: filter.label, value: valueLabel(filter) }) }}
							<icon
								v-if="!isActive(filter)"
								icon="mdi:chevron-down"
								aria-hidden="true"
							/>
						</button>

						<template #dropdown>
							<el-dropdown-menu>
								<!-- Element Plus drops a null command, so All is the empty string -->
								<el-dropdown-item command="">
									{{ t('application.listFilterBar.all') }}
								</el-dropdown-item>
								<el-dropdown-item
									v-for="option in filter.options"
									:key="option.value"
									:command="option.value"
								>
									{{ option.label }}
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>

					<button
						v-if="isActive(filter)"
						:aria-label="t('application.listFilterBar.clearFilter', { label: filter.label })"
						class="flex items-center justify-center h-[var(--el-component-size)] pr-2.5 border-0 bg-transparent text-primary cursor-pointer"
						type="button"
						data-test-id="list-filter-bar-quick-filter-clear"
						@click="emit('quick-filter', filter.id, null)"
					>
						<icon
							icon="mdi:close"
							aria-hidden="true"
						/>
					</button>
				</div>
			</template>

			<el-button
				v-if="hasDrawer"
				data-test-id="list-filter-bar-filters"
				@click="drawerOpen = true"
			>
				<template #icon>
					<icon
						icon="mdi:filter-variant"
						aria-hidden="true"
					/>
				</template>
				{{ filtersLabel }}
			</el-button>

			<span class="flex-1" />

			<el-button
				v-if="activeCount > 0"
				type="primary"
				text
				data-test-id="list-filter-bar-reset"
				@click="emit('reset')"
			>
				{{ t('application.listFilterBar.reset') }}
			</el-button>
		</div>

		<transition name="list-filter-bar-bulk">
			<div
				v-if="(props.selectedCount ?? 0) > 0"
				class="flex flex-wrap items-center gap-2 px-4 py-2 bg-primary-soft border-b border-b-solid border-primary-soft"
				data-test-id="list-filter-bar-bulk"
			>
				<span
					class="text-card-title"
					role="status"
				>
					{{ t('application.bulkActions.selected', { count: props.selectedCount }) }}
				</span>

				<el-divider direction="vertical" />

				<slot name="bulk" />

				<span class="flex-1" />

				<el-button
					type="primary"
					text
					data-test-id="list-filter-bar-clear-selection"
					@click="emit('clear-selection')"
				>
					{{ t('application.listFilterBar.clearSelection') }}
				</el-button>
			</div>
		</transition>

		<el-drawer
			v-if="hasDrawer"
			v-model="drawerOpen"
			:title="t('application.listFilterBar.filters')"
			:size="isPhone ? '100%' : '320px'"
			direction="rtl"
			append-to-body
			data-test-id="list-filter-bar-drawer"
		>
			<div class="flex flex-col gap-4">
				<template v-if="!isDesktop">
					<div
						v-for="filter in quickFilters"
						:key="filter.id"
						class="flex flex-col gap-1"
					>
						<label
							:for="`list-filter-bar-${filter.id}`"
							class="text-label"
						>
							{{ filter.label }}
						</label>
						<el-select
							:id="`list-filter-bar-${filter.id}`"
							:model-value="filter.value ?? ''"
							:placeholder="t('application.listFilterBar.all')"
							clearable
							:data-filter-id="filter.id"
							data-test-id="list-filter-bar-drawer-quick-filter"
							@update:model-value="(value: string | null | undefined) => emit('quick-filter', filter.id, value ? value : null)"
						>
							<el-option
								v-for="option in filter.options"
								:key="option.value"
								:label="option.label"
								:value="option.value"
							/>
						</el-select>
					</div>
				</template>

				<slot name="filters" />
			</div>

			<template #footer>
				<div class="flex items-center justify-end gap-2">
					<el-button
						v-if="activeCount > 0"
						data-test-id="list-filter-bar-drawer-reset"
						@click="emit('reset')"
					>
						{{ t('application.listFilterBar.reset') }}
					</el-button>
					<el-button
						type="primary"
						data-test-id="list-filter-bar-drawer-done"
						@click="drawerOpen = false"
					>
						{{ t('application.listFilterBar.done') }}
					</el-button>
				</div>
			</template>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElDrawer, ElDropdown, ElDropdownItem, ElDropdownMenu, ElInput, ElOption, ElSelect } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useSizeClass } from '../composables/useSizeClass';

import type { ListFilterBarProps, ListFilterBarQuickFilter } from './list-filter-bar.types';

defineOptions({
	name: 'ListFilterBar',
});

const props = withDefaults(defineProps<ListFilterBarProps>(), {
	search: undefined,
	searchPlaceholder: undefined,
	quickFilters: () => [],
	activeCount: 0,
	selectedCount: 0,
});

const emit = defineEmits<{
	(e: 'update:search', value: string): void;
	(e: 'quick-filter', id: string, value: string | null): void;
	(e: 'reset'): void;
	(e: 'clear-selection'): void;
}>();

const slots = useSlots();

const { t } = useI18n();

const { isDesktop, isPhone } = useSizeClass();

const drawerOpen = ref<boolean>(false);

// The design allows three quick filters in the bar; more would push the search off a 1280 px row
const quickFilters = computed<ListFilterBarQuickFilter[]>(() => props.quickFilters.slice(0, 3));

// Below desktop the quick filters move into the drawer, so the drawer is needed even without a `filters` slot
const hasDrawer = computed<boolean>(() => !!slots.filters || (!isDesktop.value && quickFilters.value.length > 0));

const activeCount = computed<number>(() => Math.max(0, props.activeCount));

const filtersLabel = computed<string>(() =>
	activeCount.value > 0 ? t('application.listFilterBar.filtersCount', { count: activeCount.value }) : t('application.listFilterBar.filters')
);

const isActive = (filter: ListFilterBarQuickFilter): boolean => filter.value !== undefined && filter.value !== null && filter.value !== '';

const valueLabel = (filter: ListFilterBarQuickFilter): string =>
	(isActive(filter) ? filter.options.find((option) => option.value === filter.value)?.label : undefined) ?? t('application.listFilterBar.all');

const onSearch = (value: string | number): void => {
	emit('update:search', String(value ?? ''));
};

// A drawer left open while the window grows to desktop would hold quick filters that are now in the bar
watch(hasDrawer, (value) => {
	if (!value) {
		drawerOpen.value = false;
	}
});
</script>

<style scoped>
.list-filter-bar-bulk-enter-active,
.list-filter-bar-bulk-leave-active {
	transition:
		opacity 0.15s ease,
		transform 0.15s ease;
}

.list-filter-bar-bulk-enter-from,
.list-filter-bar-bulk-leave-to {
	opacity: 0;
	transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
	.list-filter-bar-bulk-enter-active,
	.list-filter-bar-bulk-leave-active {
		transition: none;
	}
}
</style>
