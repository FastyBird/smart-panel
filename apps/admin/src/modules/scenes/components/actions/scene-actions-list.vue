<template>
	<div
		class="flex flex-col gap-3"
		data-test-id="scene-actions-list"
	>
		<!-- Spec section 7, sceneActionCard: the host owns the list and its add row; each plugin's card is the value
		     chip inside a row -->
		<state-view
			v-if="props.actions.length === 0"
			kind="empty"
			icon="mdi:playlist-plus"
			:title="t('scenes.edit.sections.actions.emptyTitle')"
			:description="t('scenes.edit.sections.actions.emptyDescription')"
		/>

		<ul
			v-else
			class="m-0 p-0 list-none bg-surface border border-solid border-light rounded-lg"
		>
			<scene-action-row
				v-for="(action, index) in props.actions"
				:key="action.id || index"
				:action="action"
				:card="props.cardFor(action.type)"
				:label="props.labelFor(action.type)"
				@edit="emit('edit', index)"
				@remove="emit('remove', index)"
			/>
		</ul>

		<div class="flex flex-col items-start gap-1">
			<!-- One plugin adds straight away; several ask which kind first; none enabled leaves the button disabled -->
			<el-button
				v-if="enabledOptions.length <= 1"
				:disabled="enabledOptions.length === 0"
				plain
				data-test-id="add-scene-action"
				@click="onAddOne"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>
				{{ t('scenes.form.addAction') }}
			</el-button>

			<el-dropdown
				v-else
				trigger="click"
				placement="bottom-start"
				@command="(type: string) => emit('add', type)"
			>
				<el-button
					plain
					data-test-id="add-scene-action"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>
					{{ t('scenes.form.addAction') }}
					<icon
						icon="mdi:chevron-down"
						class="ml-1"
					/>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							v-for="option in enabledOptions"
							:key="option.value"
							:command="option.value"
						>
							{{ option.label }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>

			<span class="text-help">{{ t('scenes.edit.sections.actions.helperText') }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { type Component, computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StateView } from '../../../../common';
import type { ISceneActionAddForm } from '../../schemas/scenes.types';

import SceneActionRow from './scene-action-row.vue';

defineOptions({
	name: 'SceneActionsList',
});

const props = defineProps<{
	actions: (ISceneActionAddForm & { type: string })[];
	/** The action plugins a new action can come from */
	options: { value: string; label: string; disabled?: boolean }[];
	cardFor: (type: string) => Component | null;
	labelFor: (type: string) => string;
}>();

const emit = defineEmits<{
	(e: 'add', type: string): void;
	(e: 'edit', index: number): void;
	(e: 'remove', index: number): void;
}>();

const { t } = useI18n();

const enabledOptions = computed(() => props.options.filter((option) => !option.disabled));

const onAddOne = (): void => {
	const [option] = enabledOptions.value;

	if (option) {
		emit('add', option.value);
	}
};
</script>
