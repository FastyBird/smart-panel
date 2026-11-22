<template>
	<view-header
		:title="t('devicesModule.headings.channels.add')"
		:subtitle="t('devicesModule.subHeadings.channels.add')"
		icon="mdi:chip"
		left="close"
		:primary="{ label: t('devicesModule.buttons.save.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 md:px-4">
			<template v-if="!props.device">
				<select-channel-plugin v-model="selectedType" />

				<el-divider />
			</template>

			<template v-if="selectedType">
				<component
					:is="element?.components?.channelAddForm"
					v-if="typeof element?.components?.channelAddForm !== 'undefined'"
					:id="newChannelId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedType"
					:device="props.device"
				/>

				<channel-add-form
					v-else
					:id="newChannelId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedType"
					:device="props.device"
				/>
			</template>

			<template v-else-if="props.device">
				<component
					:is="element?.components?.channelAddForm"
					v-if="typeof element?.components?.channelAddForm !== 'undefined'"
					:id="newChannelId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="props.device.type"
					:device="props.device"
				/>

				<channel-add-form
					v-else
					:id="newChannelId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="props.device.type"
					:device="props.device"
				/>
			</template>

			<el-alert
				v-else
				:title="t('devicesModule.headings.channels.selectPlugin')"
				:description="t('devicesModule.texts.channels.selectPlugin')"
				:closable="false"
				show-icon
				type="info"
			/>
		</el-scrollbar>

		<!-- Wherever the phone app bar is not there to carry Save: in a drawer, and on a page kept open past 720 px.
		     Hidden rather than removed, so a plugin's teleported Next button keeps its target through a resize -->
		<form-footer
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			@discard="onDiscard"
			@close="onClose"
		>
			<!-- Plugin add forms with several steps teleport their own primary button (Next) here -->
			<template #primary>
				<div
					:id="SUBMIT_FORM_SM"
					class="order-2 inline-block [&>*:first-child:not(:only-child)]:hidden"
				>
					<el-button
						:loading="remoteFormResult === FormResult.WORKING"
						:disabled="remoteFormResult !== FormResult.NONE"
						type="primary"
						@click="onSubmit"
					>
						<template
							v-if="remoteFormResult === FormResult.OK || remoteFormResult === FormResult.ERROR"
							#icon
						>
							<icon
								v-if="remoteFormResult === FormResult.OK"
								icon="mdi:check-circle"
							/>
							<icon
								v-else-if="remoteFormResult === FormResult.ERROR"
								icon="mdi:cross-circle"
							/>
						</template>
						{{ t('devicesModule.buttons.save.title') }}
					</el-button>
				</div>
			</template>
		</form-footer>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElAlert, ElButton, ElDivider, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBreadcrumbs,
	FormFooter,
	type IPlugin,
	type IPluginElement,
	SUBMIT_FORM_SM,
	ViewHeader,
	useEditDrawer,
	useSizeClass,
	useUuid,
} from '../../../common';
import SelectChannelPlugin from '../components/channels/select-channel-plugin.vue';
import { ChannelAddForm } from '../components/components';
import { useChannelsPlugins } from '../composables/useChannelsPlugins';
import { FormResult, type FormResultType, RouteNames } from '../devices.constants';
import type { IChannelPluginsComponents, IChannelPluginsSchemas } from '../devices.types';

import type { IViewChannelAddProps } from './view-channel-add.types';

defineOptions({
	name: 'ViewChannelAdd',
});

const props = defineProps<IViewChannelAddProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('devicesModule.meta.channels.add.title'),
});

const { generate: uuidGenerate } = useUuid();

// Template 4: the form sits in a drawer from tablet portrait up and is its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const newChannelId = uuidGenerate();

const { plugins } = useChannelsPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const selectedType = ref<IPluginElement['type'] | undefined>(undefined);

const plugin = computed<IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>(() => {
	const deviceType = props.device?.type;

	return deviceType
		? plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === deviceType))
		: plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === selectedType.value));
});

const element = computed<IPluginElement<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>(() => {
	const type = props.device?.type ?? selectedType.value;
	return (plugin.value?.elements ?? []).find((element) => element.type === type);
});

const isDeviceDetailRoute = computed<boolean>(
	(): boolean =>
		route.matched.find((matched) => {
			return matched.name === RouteNames.DEVICE;
		}) !== undefined
);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [];

		if (isDeviceDetailRoute.value) {
			items.push({
				label: t('devicesModule.breadcrumbs.devices.list'),
				route: router.resolve({ name: RouteNames.DEVICES }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.devices.detail', { device: props.device?.name }),
				route: router.resolve({ name: RouteNames.DEVICE, params: { id: props.device?.id } }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.channels.add'),
				route: router.resolve({ name: RouteNames.DEVICE_ADD_CHANNEL, params: { id: props.device?.id } }),
			});
		} else {
			items.push({
				label: t('devicesModule.breadcrumbs.channels.list'),
				route: router.resolve({ name: RouteNames.CHANNELS }),
			});
			items.push({
				label: t('devicesModule.breadcrumbs.channels.add'),
				route: router.resolve({ name: RouteNames.CHANNELS_ADD }),
			});
		}

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('devicesModule.texts.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
		confirmButtonText: t('devicesModule.buttons.yes.title'),
		cancelButtonText: t('devicesModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isDeviceDetailRoute.value) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
				} else {
					router.push({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
				}
			} else {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.CHANNELS });
				} else {
					router.push({ name: RouteNames.CHANNELS });
				}
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	if (isDeviceDetailRoute.value) {
		if (inDrawer.value) {
			router.replace({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
		} else {
			router.push({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
		}
	} else {
		if (inDrawer.value) {
			router.replace({ name: RouteNames.CHANNELS });
		} else {
			router.push({ name: RouteNames.CHANNELS });
		}
	}
};

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (isDeviceDetailRoute.value) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
				} else {
					router.push({ name: RouteNames.DEVICE, params: { id: props.device?.id } });
				}
			} else {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.CHANNELS });
				} else {
					router.push({ name: RouteNames.CHANNELS });
				}
			}
		}
	}
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
