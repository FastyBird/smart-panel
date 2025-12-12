<template>
	<el-card v-if="location">
		<template #header>
			<div class="flex items-center justify-between">
				<span class="font-semibold">{{ t('weatherModule.headings.locations.edit') }}: {{ location.name }}</span>
			</div>
		</template>

		<location-edit-form
			:location="location"
			v-model:remote-form-submit="remoteFormSubmit"
			v-model:remote-form-result="remoteFormResult"
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

	<el-card v-else-if="isLoading">
		<el-skeleton :rows="5" />
	</el-card>

	<el-card v-else>
		<el-empty :description="t('weatherModule.messages.locations.notFound')" />
	</el-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElCard, ElEmpty, ElSkeleton } from 'element-plus';

import { LocationEditForm } from '../components/components';
import { useLocation } from '../composables';
import { FormResult, type FormResultType, RouteNames } from '../weather.constants';

defineOptions({
	name: 'ViewLocationEdit',
});

const props = defineProps<{
	id: string;
}>();

const router = useRouter();
const { t } = useI18n();

const { location, isLoading } = useLocation({ id: props.id });

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onCancel = (): void => {
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
