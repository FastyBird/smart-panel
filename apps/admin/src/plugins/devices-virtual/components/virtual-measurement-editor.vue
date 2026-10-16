<template>
	<el-select
		v-if="mode === 'sensor_transform' && !outputId"
		v-model="kind"
		:disabled="busy"
		class="mb-3"
		data-test-id="measurement-kind"
	>
		<el-option
			value="numeric"
			:label="t('devicesVirtualPlugin.measurement.transform')"
		/>
		<el-option
			value="dew_point"
			:label="t('devicesVirtualPlugin.dewPoint.title')"
		/>
	</el-select>
	<virtual-dew-point-editor
		v-if="kind === 'dew_point'"
		:key="outputId ?? 'draft-dew-point'"
		:output-id="outputId"
		@created="emit('created', $event)"
		@busy="setBusy"
	/>
	<virtual-numeric-measurement-editor
		v-else
		:key="outputId ?? 'draft-numeric'"
		:mode="mode"
		:output-id="outputId"
		:temperature="temperature"
		@created="emit('created', $event)"
		@busy="setBusy"
	/>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElOption, ElSelect } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { channelsPropertiesStoreKey } from '../../../modules/devices/store/keys';
import type { MeasurementMode } from '../utils/measurement-authoring.utils';

import VirtualDewPointEditor from './virtual-dew-point-editor.vue';
import VirtualNumericMeasurementEditor from './virtual-numeric-measurement-editor.vue';

const props = defineProps<{ mode: MeasurementMode; outputId?: string; temperature?: boolean }>();
const emit = defineEmits<{ created: [deviceId: string]; busy: [value: boolean] }>();
const { t } = useI18n(),
	properties = injectStoresManager().getStore(channelsPropertiesStoreKey);
const kind = ref('numeric'),
	busy = ref(false);
watch(
	() =>
		props.outputId && props.mode === 'sensor_transform'
			? (properties.findById(props.outputId) as { measurementQuantity?: string } | null)?.measurementQuantity
			: null,
	(quantity) => {
		if (props.outputId) kind.value = quantity === 'dew_point' ? 'dew_point' : 'numeric';
	},
	{ immediate: true }
);
function setBusy(value: boolean) {
	busy.value = value;
	emit('busy', value);
}
</script>
