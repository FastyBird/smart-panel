<template>
	<el-card>
		<template #header>
			<div class="flex items-center justify-between">
				<span class="font-semibold">{{ t('weatherModule.headings.locations.add') }}</span>
			</div>
		</template>

		<location-add-form
			v-model:remote-form-submit="remoteFormSubmit"
			v-model:remote-form-result="remoteFormResult"
			@added="onLocationAdded"
		/>

		<template #footer>
			<div class="flex justify-end gap-2">
				<el-button @click="onCancel">
					{{ t('weatherModule.buttons.cancel.title') }}
				</el-button>
				<el-button
					type="primary"
					:loading="remoteFormResult === FormResult.WORKING"
					@click="onSubmit"
				>
					{{ t('weatherModule.buttons.save.title') }}
				</el-button>
			</div>
		</template>
	</el-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElCard } from 'element-plus';

import { LocationAddForm } from '../components/components';
import { FormResult, type FormResultType, RouteNames } from '../weather.constants';

defineOptions({
	name: 'ViewLocationAdd',
});

const router = useRouter();
const { t } = useI18n();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onCancel = (): void => {
	router.push({ name: RouteNames.WEATHER_LOCATIONS });
};

const onLocationAdded = (): void => {
	router.push({ name: RouteNames.WEATHER_LOCATIONS });
};

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			router.push({ name: RouteNames.WEATHER_LOCATIONS });
		}
	}
);
</script>
