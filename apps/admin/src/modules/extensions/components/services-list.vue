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
			<el-alert
				type="info"
				:description="t('extensionsModule.services.texts.alwaysActiveDescription')"
				show-icon
				:closable="false"
			/>

			<section
				v-if="moduleServices.length > 0"
				class="flex flex-col gap-3"
			>
				<h3 class="font-medium text-base">{{ t('extensionsModule.services.headings.modules') }}</h3>
				<service-item
					v-for="service in moduleServices"
					:key="getServiceKey(service.extensionKind, service.extensionType, service.serviceId)"
					:service="service"
					:extension-name="extensionNames?.[getExtensionKey(service.extensionKind, service.extensionType)]"
					:acting="isActing(service.extensionKind, service.extensionType, service.serviceId)"
					@start="onStart(service.extensionKind, service.extensionType, service.serviceId)"
					@stop="onStop(service.extensionKind, service.extensionType, service.serviceId)"
					@restart="onRestart(service.extensionKind, service.extensionType, service.serviceId)"
				/>
			</section>

			<section
				v-if="pluginServices.length > 0"
				class="flex flex-col gap-3"
			>
				<h3 class="font-medium text-base">{{ t('extensionsModule.services.headings.plugins') }}</h3>
				<service-item
					v-for="service in pluginServices"
					:key="getServiceKey(service.extensionKind, service.extensionType, service.serviceId)"
					:service="service"
					:extension-name="extensionNames?.[getExtensionKey(service.extensionKind, service.extensionType)]"
					:acting="isActing(service.extensionKind, service.extensionType, service.serviceId)"
					@start="onStart(service.extensionKind, service.extensionType, service.serviceId)"
					@stop="onStop(service.extensionKind, service.extensionType, service.serviceId)"
					@restart="onRestart(service.extensionKind, service.extensionType, service.serviceId)"
				/>
			</section>
		</div>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElResult, ElSkeleton, ElScrollbar } from 'element-plus';

import ServiceItem from './service-item.vue';
import { groupServicesByOwnerKind } from './services-list.utils';

import { getServiceKey } from '../store/services.store.types';
import type { IService } from '../store/services.store.types';

defineOptions({
	name: 'ServicesList',
});

interface IServicesListProps {
	services: IService[];
	loading?: boolean;
	extensionNames?: Record<string, string>;
	isActing: (extensionKind: IService['extensionKind'], extensionType: string, serviceId: string) => boolean;
}

interface IServicesListEmits {
	(e: 'start', extensionKind: IService['extensionKind'], extensionType: string, serviceId: string): void;
	(e: 'stop', extensionKind: IService['extensionKind'], extensionType: string, serviceId: string): void;
	(e: 'restart', extensionKind: IService['extensionKind'], extensionType: string, serviceId: string): void;
}

const props = defineProps<IServicesListProps>();

const emit = defineEmits<IServicesListEmits>();

const { t } = useI18n();

const moduleServices = computed<IService[]>(() => groupServicesByOwnerKind(props.services).modules);

const pluginServices = computed<IService[]>(() => groupServicesByOwnerKind(props.services).plugins);

const getExtensionKey = (extensionKind: IService['extensionKind'], extensionType: string): string =>
	`${extensionKind}:${extensionType}`;

const onStart = (extensionKind: IService['extensionKind'], extensionType: string, serviceId: string): void => {
	emit('start', extensionKind, extensionType, serviceId);
};

const onStop = (extensionKind: IService['extensionKind'], extensionType: string, serviceId: string): void => {
	emit('stop', extensionKind, extensionType, serviceId);
};

const onRestart = (extensionKind: IService['extensionKind'], extensionType: string, serviceId: string): void => {
	emit('restart', extensionKind, extensionType, serviceId);
};
</script>
