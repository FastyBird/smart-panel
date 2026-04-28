<template>
	<el-button
		v-if="plugin?.routes?.configure"
		size="small"
		plain
		data-test-id="configure-space"
		@click.stop="onConfigureSpace"
	>
		<template #icon>
			<icon icon="mdi:cogs" />
		</template>

		{{ t('spacesModule.buttons.configure.title') }}
	</el-button>
	<el-button
		size="small"
		plain
		class="ml-1!"
		data-test-id="edit-space"
		@click.stop="emit('edit', props.space.id)"
	>
		<template #icon>
			<icon icon="mdi:pencil" />
		</template>
	</el-button>
	<el-button
		size="small"
		type="warning"
		plain
		class="ml-1!"
		data-test-id="remove-space"
		@click.stop="emit('remove', props.space.id)"
	>
		<template #icon>
			<icon icon="mdi:trash" />
		</template>
	</el-button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

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
