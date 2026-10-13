<template>
	<div class="p-4 overflow-auto">
		<el-button
			class="mb-3"
			@click="router.push({ name: VirtualRouteNames.WIZARD })"
		>
			{{ t('devicesModule.wizard.actions.back') }}
		</el-button>
		<virtual-measurement-editor
			:mode="mode"
			@created="onCreated"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { RouteNames } from '../../../modules/devices';
import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';
import VirtualMeasurementEditor from '../components/virtual-measurement-editor.vue';
import { RouteNames as VirtualRouteNames } from '../devices-virtual.constants';

const { t } = useI18n(),
	router = useRouter(),
	route = useRoute();
const mode = computed(() =>
	route.query.mode === DevicesVirtualPluginDeviceMode.sensor_transform
		? DevicesVirtualPluginDeviceMode.sensor_transform
		: DevicesVirtualPluginDeviceMode.sensor_aggregate
);
const onCreated = (id: string) => router.push({ name: RouteNames.DEVICE, params: { id } });
</script>
