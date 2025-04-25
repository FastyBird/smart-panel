<template>
	<el-button
		v-if="plugin?.routes?.configure"
		size="small"
		plain
		data-test-id="configure-page"
		@click.stop="onConfigurePage"
	>
		<template #icon>
			<icon icon="mdi:cogs" />
		</template>

		{{ t('dashboardModule.buttons.configure.title') }}
	</el-button>
	<el-button
		size="small"
		plain
		class="ml-1!"
		data-test-id="detail-page"
		@click.stop="emit('detail', props.page.id)"
	>
		<template #icon>
			<icon icon="mdi:file-search-outline" />
		</template>

		{{ t('dashboardModule.buttons.detail.title') }}
	</el-button>
	<el-button
		size="small"
		plain
		class="ml-1!"
		data-test-id="edit-page"
		@click.stop="emit('edit', props.page.id)"
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
		data-test-id="remove-page"
		@click.stop="emit('remove', props.page.id)"
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

import { usePagesPlugin } from '../../composables/composables';
import type { IPage } from '../../store/pages.store.types';

import type { IPagesTableColumnIconProps } from './pages-table-column-icon.types';

defineOptions({
	name: 'PagesTableColumnActions',
});

const props = defineProps<IPagesTableColumnIconProps>();

const emit = defineEmits<{
	(e: 'detail', id: IPage['id']): void;
	(e: 'edit', id: IPage['id']): void;
	(e: 'remove', id: IPage['id']): void;
}>();

const { t } = useI18n();
const router = useRouter();

const { plugin } = usePagesPlugin({ type: props.page.type });

const onConfigurePage = () => {
	const configureRoute = plugin.value?.routes?.configure;

	if (!configureRoute) {
		return;
	}

	if (typeof configureRoute === 'function') {
		router.push(configureRoute(props.page.id));
	} else {
		router.push(configureRoute);
	}
};
</script>
