<template>
	<div class="p-4 overflow-auto">
		<el-button
			class="mb-3"
			@click="router.push({ name: VirtualRouteNames.WIZARD })"
		>
			Back
		</el-button>
		<virtual-thermostat-editor
			create
			@created="onCreated"
		/>
	</div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { RouteNames as DeviceRouteNames } from '../../../modules/devices';
import VirtualThermostatEditor from '../components/virtual-thermostat-editor.vue';
import { RouteNames as VirtualRouteNames } from '../devices-virtual.constants';

const router = useRouter();
const onCreated = (id: string) => router.push({ name: DeviceRouteNames.DEVICE, params: { id } });
</script>
