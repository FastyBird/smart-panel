<template>
	<div
		class="inline-flex items-center gap-1"
		@click.stop
	>
		<!-- Spec section 4: Edit is an icon, Remove (destructive) lives in the more menu; the row itself opens the detail -->
		<el-tooltip
			:content="t('weatherModule.buttons.edit.title')"
			placement="top"
		>
			<el-button
				:aria-label="t('weatherModule.aria.edit', { location: props.location.name })"
				text
				circle
				data-test-id="edit-location"
				@click="emit('edit', props.location.id)"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
			</el-button>
		</el-tooltip>

		<el-tooltip
			:content="t('weatherModule.buttons.more.title')"
			placement="top"
		>
			<el-dropdown
				trigger="click"
				placement="bottom-end"
				@command="onCommand"
			>
				<el-button
					:aria-label="t('weatherModule.aria.more', { location: props.location.name })"
					text
					circle
					data-test-id="more-location"
				>
					<template #icon>
						<icon icon="mdi:dots-horizontal" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							command="detail"
							data-test-id="detail-location"
						>
							{{ t('weatherModule.buttons.detail.title') }}
						</el-dropdown-item>
						<!-- The backend keeps the primary location: another one has to become primary first -->
						<el-dropdown-item
							command="remove"
							divided
							:disabled="props.primary"
							class="text-danger!"
							data-test-id="remove-location"
						>
							{{ t('weatherModule.buttons.remove.title') }}
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

import type { IWeatherLocation } from '../store/locations.store.types';

defineOptions({
	name: 'LocationsRowActions',
});

const props = defineProps<{ location: IWeatherLocation; primary: boolean }>();

const emit = defineEmits<{
	(e: 'detail', id: IWeatherLocation['id']): void;
	(e: 'edit', id: IWeatherLocation['id']): void;
	(e: 'remove', id: IWeatherLocation['id']): void;
}>();

const { t } = useI18n();

const onCommand = (command: 'detail' | 'remove'): void => {
	if (command === 'detail') {
		emit('detail', props.location.id);
	} else {
		emit('remove', props.location.id);
	}
};
</script>
