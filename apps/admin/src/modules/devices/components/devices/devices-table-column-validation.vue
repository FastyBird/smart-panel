<template>
	<el-link
		:type="linkType"
		underline="never"
		class="font-400!"
		@click.stop="onFilterClick"
	>
		<el-icon class="el-icon--left">
			<icon
				v-if="isFiltered"
				icon="mdi:filter-minus"
			/>
			<icon
				v-else
				icon="mdi:filter-plus"
			/>
		</el-icon>

		<el-tag
			v-if="isLoading"
			size="small"
			type="info"
		>
			<icon
				icon="mdi:loading"
				class="animate-spin"
			/>
		</el-tag>
		<el-tag
			v-else-if="isValid === true"
			size="small"
			type="success"
		>
			{{ t('devicesModule.validation.status.valid') }}
		</el-tag>
		<el-tag
			v-else-if="isValid === false"
			size="small"
			type="danger"
		>
			{{ t('devicesModule.validation.status.invalid') }}
			<template v-if="issueCount > 0">
				({{ issueCount }})
			</template>
		</el-tag>
		<el-tag
			v-else
			size="small"
			type="info"
		>
			{{ t('devicesModule.validation.status.unknown') }}
		</el-tag>
	</el-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElLink, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useDeviceValidation } from '../../composables/composables';

import type { IDevicesTableColumnValidationProps } from './devices-table-column-validation.types';

defineOptions({
	name: 'DevicesTableColumnValidation',
});

const props = defineProps<IDevicesTableColumnValidationProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: 'valid' | 'invalid', add: boolean): void;
}>();

const { t } = useI18n();

const { isValid, issues, isLoading } = useDeviceValidation({ id: props.device.id });

const issueCount = computed<number>(() => issues.value.length);

const currentFilterValue = computed<'valid' | 'invalid' | null>(() => {
	if (isValid.value === true) return 'valid';
	if (isValid.value === false) return 'invalid';
	return null;
});

const isFiltered = computed<boolean>(() => {
	if (currentFilterValue.value === null) return false;
	return props.filters.validation === currentFilterValue.value;
});

const linkType = computed<'danger' | undefined>(() => {
	return isFiltered.value ? 'danger' : undefined;
});

const onFilterClick = (): void => {
	if (currentFilterValue.value === null) return;
	emit('filter-by', currentFilterValue.value, !isFiltered.value);
};
</script>
