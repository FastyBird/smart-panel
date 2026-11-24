<template>
	<div
		class="inline-flex items-center gap-1"
		@click.stop
	>
		<!-- Spec section 4: Edit is an icon, Remove (destructive) lives in the more menu; the row itself opens the detail -->
		<el-tooltip
			:content="t('displaysModule.buttons.edit.title')"
			placement="top"
		>
			<el-button
				:aria-label="t('displaysModule.aria.edit', { display: name })"
				text
				circle
				data-test-id="edit-display"
				@click="emit('edit', props.display.id)"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
			</el-button>
		</el-tooltip>

		<el-tooltip
			:content="t('displaysModule.buttons.more.title')"
			placement="top"
		>
			<el-dropdown
				trigger="click"
				placement="bottom-end"
				@command="onCommand"
			>
				<el-button
					:aria-label="t('displaysModule.aria.more', { display: name })"
					text
					circle
					data-test-id="more-display"
				>
					<template #icon>
						<icon icon="mdi:dots-horizontal" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							command="detail"
							data-test-id="detail-display"
						>
							{{ t('displaysModule.buttons.detail.title') }}
						</el-dropdown-item>
						<el-dropdown-item
							command="remove"
							divided
							class="text-danger!"
							data-test-id="remove-display"
						>
							{{ t('displaysModule.buttons.remove.title') }}
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

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IDisplay } from '../store/displays.store.types';

defineOptions({
	name: 'DisplaysRowActions',
});

const props = defineProps<{ display: IDisplay }>();

const emit = defineEmits<{
	(e: 'detail', id: IDisplay['id']): void;
	(e: 'edit', id: IDisplay['id']): void;
	(e: 'remove', id: IDisplay['id']): void;
}>();

const { t } = useI18n();

const name = computed<string>((): string => props.display.name || props.display.macAddress);

const onCommand = (command: 'detail' | 'remove'): void => {
	if (command === 'detail') {
		emit('detail', props.display.id);
	} else {
		emit('remove', props.display.id);
	}
};
</script>
