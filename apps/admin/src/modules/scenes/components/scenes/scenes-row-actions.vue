<template>
	<div
		class="inline-flex items-center gap-1"
		@click.stop
	>
		<!-- Spec section 4: Run keeps its label, Edit is an icon, Delete (destructive) lives in the more menu -->
		<el-button
			v-if="props.scene.triggerable"
			:loading="props.triggering"
			size="small"
			plain
			data-test-id="trigger-scene"
			@click="emit('trigger', props.scene.id)"
		>
			<template #icon>
				<icon icon="mdi:play" />
			</template>

			{{ t('scenes.buttons.run.title') }}
		</el-button>

		<el-tooltip
			v-if="props.scene.editable"
			:content="t('scenes.buttons.edit.title')"
			placement="top"
		>
			<el-button
				:aria-label="t('scenes.aria.edit', { scene: props.scene.name })"
				text
				circle
				data-test-id="edit-scene"
				@click="emit('edit', props.scene.id)"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
			</el-button>
		</el-tooltip>

		<el-tooltip
			v-if="props.scene.editable"
			:content="t('scenes.buttons.more.title')"
			placement="top"
		>
			<el-dropdown
				trigger="click"
				placement="bottom-end"
				@command="emit('remove', props.scene.id)"
			>
				<el-button
					:aria-label="t('scenes.aria.more', { scene: props.scene.name })"
					text
					circle
					data-test-id="more-scene"
				>
					<template #icon>
						<icon icon="mdi:dots-horizontal" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							command="remove"
							class="text-danger!"
							data-test-id="remove-scene"
						>
							{{ t('scenes.buttons.delete.title') }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</el-tooltip>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IScene } from '../../store/scenes.store.types';

defineOptions({
	name: 'ScenesRowActions',
});

const props = withDefaults(defineProps<{ scene: IScene; triggering?: boolean }>(), {
	triggering: false,
});

const emit = defineEmits<{
	(e: 'trigger', id: IScene['id']): void;
	(e: 'edit', id: IScene['id']): void;
	(e: 'remove', id: IScene['id']): void;
}>();

const { t } = useI18n();
</script>
