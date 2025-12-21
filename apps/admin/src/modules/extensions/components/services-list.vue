<template>
	<el-scrollbar
		class="h-full"
	>
		<!-- Loading state -->
		<el-skeleton
			v-if="loading && services.length === 0"
			:rows="5"
			animated
		/>

		<!-- Empty state -->
		<el-result
			v-else-if="services.length === 0"
			icon="info"
			:title="t('extensionsModule.services.texts.noServices')"
		/>

		<!-- Services list -->
		<div
			v-else
			class="flex flex-col gap-3"
		>
			<service-item
				v-for="service in services"
				:key="`${service.pluginName}:${service.serviceId}`"
				:service="service"
				:acting="isActing(service.pluginName, service.serviceId)"
				@start="onStart(service.pluginName, service.serviceId)"
				@stop="onStop(service.pluginName, service.serviceId)"
				@restart="onRestart(service.pluginName, service.serviceId)"
			/>
		</div>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElResult, ElSkeleton } from 'element-plus';

import ServiceItem from './service-item.vue';

import type { IService } from '../store/services.store.types';

defineOptions({
	name: 'ServicesList',
});

interface IServicesListProps {
	services: IService[];
	loading?: boolean;
	isActing: (pluginName: string, serviceId: string) => boolean;
}

interface IServicesListEmits {
	(e: 'start', pluginName: string, serviceId: string): void;
	(e: 'stop', pluginName: string, serviceId: string): void;
	(e: 'restart', pluginName: string, serviceId: string): void;
}

defineProps<IServicesListProps>();

const emit = defineEmits<IServicesListEmits>();

const { t } = useI18n();

const onStart = (pluginName: string, serviceId: string): void => {
	emit('start', pluginName, serviceId);
};

const onStop = (pluginName: string, serviceId: string): void => {
	emit('stop', pluginName, serviceId);
};

const onRestart = (pluginName: string, serviceId: string): void => {
	emit('restart', pluginName, serviceId);
};
</script>
