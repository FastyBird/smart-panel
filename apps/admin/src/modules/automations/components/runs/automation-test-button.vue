<template>
	<!-- A disabled button tells nothing on hover, so the reason sits on what holds it -->
	<el-tooltip
		:content="props.disabledReason ?? t('automations.runs.buttons.test.description')"
		placement="bottom"
	>
		<span
			class="inline-flex"
			:data-test-reason="props.disabledReason ?? undefined"
			data-test-id="test-automation-wrapper"
		>
			<el-dropdown
				v-if="props.triggers.length > 1"
				split-button
				trigger="click"
				:disabled="disabled"
				data-test-id="test-automation-choice"
				@click="onTest()"
				@command="onCommand"
			>
				<span class="inline-flex items-center gap-1">
					<el-icon :class="{ 'is-loading': props.loading }">
						<icon :icon="props.loading ? 'mdi:loading' : 'mdi:play'" />
					</el-icon>
					{{ t('automations.runs.buttons.test.title') }}
				</span>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							v-for="trigger in props.triggers"
							:key="trigger.id"
							:command="trigger.id"
							:data-test-node="trigger.id"
						>
							{{ t('automations.runs.buttons.test.startAt', { trigger: trigger.label }) }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>

			<el-button
				v-else
				:loading="props.loading"
				:disabled="disabled"
				data-test-id="test-automation"
				@click="onTest()"
			>
				<template #icon>
					<icon icon="mdi:play" />
				</template>
				{{ t('automations.runs.buttons.test.title') }}
			</el-button>
		</span>
	</el-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElIcon, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IAutomationTestButtonProps } from './automation-test-button.types';

defineOptions({
	name: 'AutomationTestButton',
});

const props = withDefaults(defineProps<IAutomationTestButtonProps>(), {
	disabledReason: null,
	loading: false,
});

const emit = defineEmits<{
	// No node: the run starts at the first trigger, as the backend picks it
	(e: 'test', nodeId?: string): void;
}>();

const { t } = useI18n();

const disabled = computed<boolean>((): boolean => props.disabledReason !== null || props.loading);

const onTest = (nodeId?: string): void => {
	if (disabled.value) {
		return;
	}

	if (typeof nodeId === 'string') {
		emit('test', nodeId);
	} else {
		emit('test');
	}
};

const onCommand = (command: string | number | object): void => {
	if (typeof command === 'string') {
		onTest(command);
	}
};
</script>
