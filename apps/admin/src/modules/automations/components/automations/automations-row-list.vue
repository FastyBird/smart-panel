<template>
	<!-- Phone (template 1): a list of rows instead of the table; a row opens the automation -->
	<state-view
		v-if="props.loading && props.items.length === 0"
		kind="loading"
		:title="t('automations.texts.loadingAutomations')"
		:icon="AUTOMATION_DEFAULT_ICON"
	/>

	<state-view
		v-else-if="props.loadFailed && props.items.length === 0"
		kind="error"
		:title="t('automations.texts.loadFailed')"
		:icon="AUTOMATION_DEFAULT_ICON"
	>
		<template #action>
			<el-button
				plain
				data-test-id="retry-load"
				@click="emit('retry')"
			>
				{{ t('automations.buttons.retry.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else-if="props.items.length === 0 && props.filtersActive"
		kind="empty"
		:title="t('automations.texts.noFilteredAutomations')"
		icon="mdi:filter-multiple"
	>
		<template #action>
			<el-button
				plain
				@click="emit('reset-filters')"
			>
				{{ t('automations.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else-if="props.items.length === 0"
		kind="empty"
		:title="t('automations.texts.noAutomations')"
		:icon="AUTOMATION_DEFAULT_ICON"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="automations-row-list"
	>
		<li
			v-for="automation in props.items"
			:key="automation.id"
			class="flex items-center gap-3 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
		>
			<button
				class="flex items-center gap-3 flex-1 min-w-0 p-0 border-0 bg-transparent text-left font-inherit cursor-pointer"
				type="button"
				data-test-id="automations-row"
				@click="emit('edit', automation.id)"
			>
				<span
					class="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-fill-light text-regular"
					aria-hidden="true"
				>
					<icon
						:icon="automation.icon ?? AUTOMATION_DEFAULT_ICON"
						width="20"
						height="20"
					/>
				</span>
				<span class="flex flex-col flex-1 min-w-0">
					<span class="text-card-title truncate">{{ automation.name }}</span>
					<span class="text-help truncate">
						{{ automation.lastTriggeredAt ? formatDate(automation.lastTriggeredAt) : t('automations.fields.neverRun') }}
					</span>
				</span>
				<status-tag
					:status="AUTOMATION_STATUS_TAGS[automation.status]"
					:label="t(`automations.statuses.${automation.status}.title`)"
				/>
			</button>

			<!-- The switch follows the store: it moves once the backend has accepted the change -->
			<el-switch
				:model-value="automation.enabled"
				:loading="props.updating.includes(automation.id)"
				:aria-label="t('automations.aria.enabled', { automation: automation.name })"
				data-test-id="toggle-automation"
				@change="(value: string | number | boolean): void => emit('toggle-enabled', automation.id, value === true)"
			/>

			<!-- The table's row actions: the flow, YAML export and remove (destructive, so last and in the menu) -->
			<el-dropdown
				trigger="click"
				placement="bottom-end"
				@command="(command: RowCommand): void => onCommand(command, automation.id)"
			>
				<el-button
					:aria-label="t('automations.aria.more', { automation: automation.name })"
					text
					data-test-id="automation-row-more"
				>
					<template #icon>
						<icon icon="mdi:dots-vertical" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							command="flow"
							data-test-id="automation-row-flow"
						>
							{{ t('automations.buttons.flow.title') }}
						</el-dropdown-item>
						<el-dropdown-item
							command="export"
							:disabled="props.exporting?.includes(automation.id) ?? false"
							data-test-id="automation-row-export"
						>
							{{ t('automations.buttons.exportYaml.title') }}
						</el-dropdown-item>
						<el-dropdown-item
							command="remove"
							divided
							class="text-danger!"
							data-test-id="automation-row-remove"
						>
							{{ t('automations.buttons.remove.title') }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElSwitch } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StateView, StatusTag } from '../../../../common';
import { AUTOMATION_DEFAULT_ICON, AUTOMATION_STATUS_TAGS } from '../../automations.constants';
import type { IAutomation } from '../../store/automations.store.types';

import type { IAutomationsRowListProps } from './automations-row-list.types';

defineOptions({
	name: 'AutomationsRowList',
});

const props = defineProps<IAutomationsRowListProps>();

const emit = defineEmits<{
	(e: 'edit', id: IAutomation['id']): void;
	(e: 'flow', id: IAutomation['id']): void;
	(e: 'export', id: IAutomation['id']): void;
	(e: 'remove', id: IAutomation['id']): void;
	(e: 'toggle-enabled', id: IAutomation['id'], enabled: boolean): void;
	(e: 'reset-filters'): void;
	(e: 'retry'): void;
}>();

const { t, locale } = useI18n();

type RowCommand = 'flow' | 'export' | 'remove';

const onCommand = (command: RowCommand, id: IAutomation['id']): void => {
	if (command === 'flow') {
		emit('flow', id);
	} else if (command === 'export') {
		emit('export', id);
	} else {
		emit('remove', id);
	}
};

// In the language of the application, as the table does
const formatDate = (date: Date): string => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
</script>
