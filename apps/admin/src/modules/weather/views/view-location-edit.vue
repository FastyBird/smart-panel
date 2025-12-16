<template>
	<el-card v-if="location">
		<template #header>
			<div class="flex items-center justify-between">
				<span class="font-semibold">{{ t('weatherModule.headings.locations.edit') }}: {{ location.name }}</span>
			</div>
		</template>

		<location-edit-form
			:id="location.id"
			@cancel="onCancel"
			@updated="onUpdated"
			@update:remote-form-changed="onFormChanged"
		/>
	</el-card>

	<el-card v-else-if="isLoading">
		<el-skeleton :rows="5" />
	</el-card>

	<el-card v-else>
		<el-empty :description="t('weatherModule.messages.locations.notFound')" />
	</el-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElCard, ElEmpty, ElSkeleton } from 'element-plus';

import { LocationEditForm } from '../components/components';
import { useLocation } from '../composables';
import { RouteNames } from '../weather.constants';

defineOptions({
	name: 'ViewLocationEdit',
});

const props = defineProps<{
	id: string;
}>();

const router = useRouter();
const { t } = useI18n();

const locationId = computed(() => props.id);
const { location, isLoading } = useLocation({ id: locationId });

const formChanged = ref<boolean>(false);

const onCancel = (): void => {
	router.push({ name: RouteNames.WEATHER_LOCATIONS });
};

const onUpdated = (): void => {
	router.push({ name: RouteNames.WEATHER_LOCATIONS });
};

const onFormChanged = (value: boolean): void => {
	formChanged.value = value;
};
</script>
