<template>
	<div
		v-if="props.device.hidden"
		class="flex items-center gap-1 mt-1"
	>
		<el-tag
			size="small"
			type="info"
		>
			{{ t('devicesModule.hidden.badge') }}
		</el-tag>

		<el-tooltip
			:content="hiddenByHint"
			placement="top"
			:show-after="500"
		>
			<el-tag
				size="small"
				:type="isSystemHidden ? 'warning' : 'primary'"
			>
				{{ hiddenByLabel }}
			</el-tag>
		</el-tooltip>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTag, ElTooltip } from 'element-plus';

import { DevicesModuleDeviceHiddenBy } from '../../../../openapi.constants';

import type { IDevicesTableColumnHiddenProps } from './devices-table-column-hidden.types';

defineOptions({
	name: 'DevicesTableColumnHidden',
});

const props = defineProps<IDevicesTableColumnHiddenProps>();

const { t } = useI18n();

// `hiddenBy` is only ever `system` or `user` in practice, but the model allows `null` (e.g. a
// legacy row hidden before provenance tracking existed). Anything that is not confirmed `system`
// is treated as a user hide, since that is the safer assumption: it will not go away on its own.
const isSystemHidden = computed<boolean>((): boolean => props.device.hiddenBy === DevicesModuleDeviceHiddenBy.system);

const hiddenByLabel = computed<string>((): string => {
	return isSystemHidden.value ? t('devicesModule.hidden.by.system') : t('devicesModule.hidden.by.user');
});

const hiddenByHint = computed<string>((): string => {
	return isSystemHidden.value ? t('devicesModule.hidden.hint.system') : t('devicesModule.hidden.hint.user');
});
</script>
