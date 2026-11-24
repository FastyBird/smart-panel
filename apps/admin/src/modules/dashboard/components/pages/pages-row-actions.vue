<template>
	<div
		class="inline-flex items-center gap-1"
		@click.stop
	>
		<!-- Spec section 4: Configure keeps its label, Edit is an icon, Remove (destructive) lives in the more menu; the
		     row itself opens the detail. Where the actions column is narrow, Configure moves into the menu -->
		<el-button
			v-if="configureRoute && !props.compact"
			size="small"
			plain
			data-test-id="configure-page"
			@click="onConfigure"
		>
			<template #icon>
				<icon icon="mdi:cogs" />
			</template>

			{{ t('dashboardModule.buttons.configure.title') }}
		</el-button>

		<el-tooltip
			:content="t('dashboardModule.buttons.edit.title')"
			placement="top"
		>
			<el-button
				:aria-label="t('dashboardModule.aria.pages.edit', { page: props.page.title })"
				text
				circle
				data-test-id="edit-page"
				@click="emit('edit', props.page.id)"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
			</el-button>
		</el-tooltip>

		<el-tooltip
			:content="t('dashboardModule.buttons.more.title')"
			placement="top"
		>
			<el-dropdown
				trigger="click"
				placement="bottom-end"
				@command="onCommand"
			>
				<el-button
					:aria-label="t('dashboardModule.aria.pages.more', { page: props.page.title })"
					text
					circle
					data-test-id="more-page"
				>
					<template #icon>
						<icon icon="mdi:dots-horizontal" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							v-if="configureRoute && props.compact"
							command="configure"
							data-test-id="configure-page-menu"
						>
							{{ t('dashboardModule.buttons.configure.title') }}
						</el-dropdown-item>
						<el-dropdown-item
							command="detail"
							data-test-id="detail-page"
						>
							{{ t('dashboardModule.buttons.detail.title') }}
						</el-dropdown-item>
						<el-dropdown-item
							command="remove"
							divided
							class="text-danger!"
							data-test-id="remove-page"
						>
							{{ t('dashboardModule.buttons.remove.title') }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</el-tooltip>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RouteLocationRaw } from 'vue-router';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { usePagesPlugin } from '../../composables/usePagesPlugin';
import type { IPage } from '../../store/pages.store.types';

defineOptions({
	name: 'PagesRowActions',
});

const props = withDefaults(defineProps<{ page: IPage; compact?: boolean }>(), { compact: false });

const emit = defineEmits<{
	(e: 'configure', to: string | RouteLocationRaw): void;
	(e: 'detail', id: IPage['id']): void;
	(e: 'edit', id: IPage['id']): void;
	(e: 'remove', id: IPage['id']): void;
}>();

const { t } = useI18n();

const { plugin } = usePagesPlugin({ type: props.page.type });

// Page types with a layout to arrange (tiles, cards) open their configure screen
const configureRoute = computed(() => plugin.value?.routes?.configure);

// The host navigates, so a changed form open next to the list is asked about first
const onConfigure = (): void => {
	const to = configureRoute.value;

	if (!to) {
		return;
	}

	emit('configure', typeof to === 'function' ? to(props.page.id) : to);
};

const onCommand = (command: 'configure' | 'detail' | 'remove'): void => {
	if (command === 'configure') {
		onConfigure();
	} else if (command === 'detail') {
		emit('detail', props.page.id);
	} else {
		emit('remove', props.page.id);
	}
};
</script>
