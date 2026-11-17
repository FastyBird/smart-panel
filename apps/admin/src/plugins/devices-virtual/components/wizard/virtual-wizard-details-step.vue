<template>
	<el-form
		label-position="top"
		class="projection-details"
		status-icon
		@submit.prevent
	>
		<el-form-item
			:error="fieldError('name')"
			:label="t('devicesModule.fields.devices.name.title')"
			class="projection-details__field"
			required
		>
			<el-input
				:model-value="name"
				:placeholder="t('devicesModule.fields.devices.name.placeholder')"
				name="name"
				@update:model-value="emit('update:name', $event)"
			/>
		</el-form-item>
		<slot name="category" />
		<div class="projection-details__field">
			<virtual-placement-fields
				:room-id="roomId"
				:zone-ids="zoneIds"
				suggest-sources
				@update:room-id="emit('update:roomId', $event)"
				@update:zone-ids="emit('update:zoneIds', $event)"
			/>
		</div>
	</el-form>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput } from 'element-plus';

import { useWizardFieldError } from '../../../../modules/devices/components/wizard/use-wizard-validation';
import VirtualPlacementFields from '../virtual-placement-fields.vue';

import type { IVirtualWizardDetailsStepProps } from './virtual-wizard-details-step.types';

defineOptions({ name: 'VirtualWizardDetailsStep' });
defineProps<IVirtualWizardDetailsStepProps>();
const emit = defineEmits<{ 'update:name': [value: string]; 'update:roomId': [value: string | null]; 'update:zoneIds': [value: string[]] }>();
const { t } = useI18n();
const fieldError = useWizardFieldError();
</script>
<style scoped>
.projection-details__field {
	max-width: 600px;
}
</style>
