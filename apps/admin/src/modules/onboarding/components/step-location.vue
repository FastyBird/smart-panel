<template>
	<div class="py-4 px-4 max-w-lg mx-auto">
		<p class="text-gray-500 mb-6">
			{{ t('onboardingModule.location.description') }}
		</p>

		<el-form
			label-position="top"
			@submit.prevent
		>
			<el-form-item :label="t('onboardingModule.location.fields.city')">
				<el-input
					v-model="locationData.city"
					:placeholder="t('onboardingModule.location.placeholders.city')"
					name="city"
				/>
			</el-form-item>

			<div class="flex flex-row flex-nowrap gap-5">
				<el-form-item :label="t('onboardingModule.location.fields.latitude')">
					<el-input-number
						v-model="locationData.latitude"
						:placeholder="t('onboardingModule.location.placeholders.latitude')"
						:precision="4"
						:step="0.1"
						:min="-90"
						:max="90"
						controls-position="right"
						class="w-full!"
					/>
				</el-form-item>

				<el-form-item :label="t('onboardingModule.location.fields.longitude')">
					<el-input-number
						v-model="locationData.longitude"
						:placeholder="t('onboardingModule.location.placeholders.longitude')"
						:precision="4"
						:step="0.1"
						:min="-180"
						:max="180"
						controls-position="right"
						class="w-full!"
					/>
				</el-form-item>
			</div>
		</el-form>

		<el-alert
			type="info"
			:title="t('onboardingModule.location.hint')"
			:closable="false"
			show-icon
			class="mt-4!"
		/>
	</div>
</template>

<script setup lang="ts">
import { ElAlert, ElForm, ElFormItem, ElInput, ElInputNumber } from 'element-plus';
import { useI18n } from 'vue-i18n';

import type { ILocationData } from '../composables/composables';

defineOptions({
	name: 'StepLocation',
});

defineProps<{
	locationData: ILocationData;
}>();

const { t } = useI18n();
</script>
