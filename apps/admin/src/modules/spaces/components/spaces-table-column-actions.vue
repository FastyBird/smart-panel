<template>
	<div
		class="inline-flex items-center gap-1"
		@click.stop
	>
		<!-- Spec section 4: Configure keeps its label, Edit is an icon, Remove (destructive) lives in the more menu -->
		<el-button
			v-if="plugin?.routes?.configure"
			size="small"
			plain
			data-test-id="configure-space"
			@click="onConfigureSpace"
		>
			<template #icon>
				<icon icon="mdi:cogs" />
			</template>

			{{ t('spacesModule.buttons.configure.title') }}
		</el-button>

		<el-tooltip
			:content="t('spacesModule.buttons.edit.title')"
			placement="top"
		>
			<el-button
				:aria-label="t('spacesModule.aria.edit', { space: props.space.name })"
				text
				circle
				data-test-id="edit-space"
				@click="emit('edit', props.space.id)"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
			</el-button>
		</el-tooltip>

		<el-tooltip
			:content="t('spacesModule.buttons.more.title')"
			placement="top"
		>
			<el-dropdown
				trigger="click"
				placement="bottom-end"
				@command="emit('remove', props.space.id)"
			>
				<el-button
					:aria-label="t('spacesModule.aria.more', { space: props.space.name })"
					text
					circle
					data-test-id="more-space"
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
							data-test-id="remove-space"
						>
							{{ t('spacesModule.buttons.delete.title') }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</el-tooltip>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useSpacesPlugin } from '../composables';
import type { ISpace } from '../store/spaces.store.types';

import type { ISpacesTableColumnActionsProps } from './spaces-table-column-actions.types';

defineOptions({
	name: 'SpacesTableColumnActions',
});

const props = defineProps<ISpacesTableColumnActionsProps>();

const emit = defineEmits<{
	(e: 'edit', id: ISpace['id']): void;
	(e: 'remove', id: ISpace['id']): void;
}>();

const { t } = useI18n();
const router = useRouter();

const { plugin } = useSpacesPlugin({ type: () => props.space.type });

const onConfigureSpace = (): void => {
	const configureRoute = plugin.value?.routes?.configure;

	if (!configureRoute) {
		return;
	}

	if (typeof configureRoute === 'function') {
		router.push(configureRoute(props.space.id));
	} else {
		router.push(configureRoute);
	}
};
</script>
