<template>
	<div class="h-full flex flex-col gap-3 overflow-hidden">
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
		<template v-else>
			<el-alert
				type="info"
				:description="t('extensionsModule.services.texts.alwaysActiveDescription')"
				show-icon
				:closable="false"
			/>

			<el-tabs
				v-model="activeKindModel"
				class="services-kind-tabs grow-1 min-h-0 overflow-hidden"
			>
				<el-tab-pane
					v-for="tab in serviceTabs"
					:key="tab.name"
					:name="tab.name"
					class="h-full"
				>
					<template #label>
						<div class="flex items-center gap-2">
							<icon :icon="tab.icon" />
							{{ tab.label }}
						</div>
					</template>

					<el-scrollbar class="h-full">
						<el-result
							v-if="tab.services.length === 0"
							icon="info"
							:title="t('extensionsModule.services.texts.noServices')"
						/>

						<div
							v-else
							class="flex flex-col gap-3"
						>
							<service-item
								v-for="service in tab.services"
								:key="getServiceKey(service.extensionKind, service.extensionType, service.serviceId)"
								:service="service"
								:extension-name="extensionNames?.[getExtensionKey(service.extensionKind, service.extensionType)]"
								:acting="isActing(service.extensionKind, service.extensionType, service.serviceId)"
								@start="onStart(service.extensionKind, service.extensionType, service.serviceId)"
								@stop="onStop(service.extensionKind, service.extensionType, service.serviceId)"
								@restart="onRestart(service.extensionKind, service.extensionType, service.serviceId)"
							/>
						</div>
					</el-scrollbar>
				</el-tab-pane>
			</el-tabs>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElResult, ElScrollbar, ElSkeleton, ElTabPane, ElTabs } from 'element-plus';

import { Icon } from '@iconify/vue';

import { ExtensionsModuleServiceOwnerKind } from '../../../openapi.constants';
import { getServiceKey } from '../store/services.store.types';
import type { IService } from '../store/services.store.types';

import ServiceItem from './service-item.vue';
import { groupServicesByOwnerKind } from './services-list.utils';

defineOptions({
	name: 'ServicesList',
});

interface IServicesListProps {
	activeKind: ExtensionsModuleServiceOwnerKind;
	services: IService[];
	loading?: boolean;
	extensionNames?: Record<string, string>;
	isActing: (extensionKind: IService['extensionKind'], extensionType: string, serviceId: string) => boolean;
}

interface IServicesListEmits {
	(e: 'update:activeKind', activeKind: ExtensionsModuleServiceOwnerKind): void;
	(e: 'start', extensionKind: IService['extensionKind'], extensionType: string, serviceId: string): void;
	(e: 'stop', extensionKind: IService['extensionKind'], extensionType: string, serviceId: string): void;
	(e: 'restart', extensionKind: IService['extensionKind'], extensionType: string, serviceId: string): void;
}

const props = defineProps<IServicesListProps>();

const emit = defineEmits<IServicesListEmits>();

const { t } = useI18n();

const activeKindModel = computed<ExtensionsModuleServiceOwnerKind>({
	get: (): ExtensionsModuleServiceOwnerKind => props.activeKind,
	set: (activeKind: ExtensionsModuleServiceOwnerKind): void => emit('update:activeKind', activeKind),
});

const serviceTabs = computed<
	{
		name: ExtensionsModuleServiceOwnerKind;
		label: string;
		icon: string;
		services: IService[];
	}[]
>(() => {
	const groupedServices = groupServicesByOwnerKind(props.services);

	return [
		{
			name: ExtensionsModuleServiceOwnerKind.module,
			label: t('extensionsModule.tabs.modules'),
			icon: 'mdi:package-variant',
			services: groupedServices.modules,
		},
		{
			name: ExtensionsModuleServiceOwnerKind.plugin,
			label: t('extensionsModule.tabs.plugins'),
			icon: 'mdi:toy-brick',
			services: groupedServices.plugins,
		},
	];
});

const getExtensionKey = (extensionKind: IService['extensionKind'], extensionType: string): string => `${extensionKind}:${extensionType}`;

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

<style scoped lang="scss">
.services-kind-tabs {
	display: flex;
	flex-direction: column;

	:deep(.el-tabs__content) {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
}
</style>
