<template>
	<div
		class="flex items-center gap-2 mt-1"
		:data-test-id="`${props.collection}-load-failed`"
	>
		<el-text
			size="small"
			type="danger"
			class="leading-4!"
		>
			{{ t(`automations.editor.fields.${FIELDS[props.collection]}.loadFailed`) }}
		</el-text>
		<el-button
			link
			type="primary"
			size="small"
			:loading="props.loading"
			:data-test-id="`retry-load-${props.collection}`"
			@click="emit('retry')"
		>
			<template #icon>
				<icon icon="mdi:refresh" />
			</template>
			{{ t('automations.buttons.retry.title') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
/*
 * Said under a picker whose devices, scenes or automations could not be read, so the picker is not taken
 * for there being nothing to pick, with a way to read them again.
 */
import { useI18n } from 'vue-i18n';

import { ElButton, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { AutomationLookupCollection, IAutomationLookupLoadFailedProps } from './automation-lookup-load-failed.types';

defineOptions({
	name: 'AutomationLookupLoadFailed',
});

const FIELDS: Record<AutomationLookupCollection, string> = {
	devices: 'device',
	scenes: 'scene',
	automations: 'automation',
};

const props = withDefaults(defineProps<IAutomationLookupLoadFailedProps>(), {
	loading: false,
});

const emit = defineEmits<{
	(e: 'retry'): void;
}>();

const { t } = useI18n();
</script>
