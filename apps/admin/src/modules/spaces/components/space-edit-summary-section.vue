<template>
	<div class="space-edit-summary-section">
		<el-alert
			:title="props.spaceType === SpaceType.ROOM
				? t('spacesModule.edit.sections.devicesDisplays.summary', { devices: props.deviceCount, displays: props.displayCount })
				: t('spacesModule.edit.sections.devicesDisplays.summaryDevicesOnly', { devices: props.deviceCount })"
			type="info"
			:closable="false"
			show-icon
			class="mb-4!"
		/>

		<div class="flex gap-2 flex-wrap">
			<el-button
				type="primary"
				plain
				@click="emit('manage-devices')"
			>
				<template #icon>
					<icon icon="mdi:devices" />
				</template>
				{{ t('spacesModule.edit.sections.devicesDisplays.manageDevices') }}
			</el-button>

			<el-button
				v-if="props.spaceType === SpaceType.ROOM"
				type="primary"
				plain
				@click="emit('manage-displays')"
			>
				<template #icon>
					<icon icon="mdi:monitor" />
				</template>
				{{ t('spacesModule.edit.sections.devicesDisplays.manageDisplays') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { SpaceType } from '../spaces.constants';

import { type ISpaceEditSummarySectionProps, spaceEditSummarySectionEmits } from './space-edit-summary-section.types';

defineOptions({
	name: 'SpaceEditSummarySection',
});

const props = defineProps<ISpaceEditSummarySectionProps>();

const emit = defineEmits(spaceEditSummarySectionEmits);

const { t } = useI18n();
</script>
