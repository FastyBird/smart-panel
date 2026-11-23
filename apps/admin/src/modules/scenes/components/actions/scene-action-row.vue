<template>
	<li
		class="flex items-center gap-3 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
		data-test-id="scene-action-row"
	>
		<!-- Spec section 7, sceneActionCard: the host draws the row, the domain icon and the device → channel → property
		     it targets; the plugin's card adds only the value chip -->
		<domain-icon
			v-if="domain"
			:domain="domain"
		/>
		<span
			v-else
			class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-[8px] bg-fill-light text-secondary"
			aria-hidden="true"
			data-test-id="scene-action-row-icon"
		>
			<icon
				icon="mdi:play-box-outline"
				width="20"
				height="20"
			/>
		</span>

		<span class="flex flex-col items-start gap-0.5 flex-1 min-w-0">
			<span
				class="max-w-full text-card-title truncate"
				data-test-id="scene-action-row-title"
			>
				{{ title }}
			</span>
			<span
				v-if="path"
				class="max-w-full text-help truncate"
				data-test-id="scene-action-row-path"
			>
				{{ path }}
			</span>
			<status-tag
				v-if="isMissing"
				status="danger"
				:label="t('scenes.actions.missing')"
				data-test-id="scene-action-row-missing"
			/>
		</span>

		<component
			:is="props.card"
			v-if="props.card"
			:action="props.action"
			class="shrink-0"
		/>

		<span class="inline-flex items-center gap-1 shrink-0">
			<el-tooltip
				:content="t('scenes.buttons.edit.title')"
				placement="top"
			>
				<el-button
					:aria-label="t('scenes.aria.editAction', { action: title })"
					text
					circle
					data-test-id="edit-scene-action"
					@click="emit('edit')"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
				</el-button>
			</el-tooltip>

			<el-tooltip
				:content="t('scenes.buttons.more.title')"
				placement="top"
			>
				<el-dropdown
					trigger="click"
					placement="bottom-end"
					@command="emit('remove')"
				>
					<el-button
						:aria-label="t('scenes.aria.moreAction', { action: title })"
						text
						circle
						data-test-id="more-scene-action"
					>
						<template #icon>
							<icon icon="mdi:dots-horizontal" />
						</template>
					</el-button>

					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item
								command="remove"
								class="text-danger!"
								data-test-id="remove-scene-action"
							>
								{{ t('scenes.buttons.delete.title') }}
							</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</el-tooltip>
		</span>
	</li>
</template>

<script setup lang="ts">
import { type Component, computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { DomainIcon, StatusTag, deviceCategoryDomain } from '../../../../common';
import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import { useChannels, useChannelsProperties, useDevices } from '../../../devices';
import type { ISceneActionAddForm } from '../../schemas/scenes.types';

defineOptions({
	name: 'SceneActionRow',
});

const props = withDefaults(
	defineProps<{
		action: ISceneActionAddForm & { type: string };
		/** The plugin's card: the value chip */
		card?: Component | null;
		/** The plugin element's name, the title of an action that targets no device */
		label: string;
	}>(),
	{
		card: null,
	}
);

const emit = defineEmits<{
	(e: 'edit'): void;
	(e: 'remove'): void;
}>();

const { t } = useI18n();

// An action that targets a device property names it at the root (camelCase), older ones in the configuration
const readId = (camel: string, snake: string): string | null => {
	const value = props.action[camel] ?? props.action.configuration?.[snake];

	return typeof value === 'string' && value !== '' ? value : null;
};

const deviceId = computed<string | null>((): string | null => readId('deviceId', 'device_id'));
const channelId = computed<string | null>((): string | null => readId('channelId', 'channel_id'));
const propertyId = computed<string | null>((): string | null => readId('propertyId', 'property_id'));

const { devices, fetchDevices, loaded: devicesLoaded } = useDevices();
const { channels, fetchChannels } = useChannels({ deviceId: computed<string>((): string => deviceId.value ?? '') });
const { properties, fetchProperties } = useChannelsProperties({ channelId: computed<string | undefined>((): string | undefined => channelId.value ?? undefined) });

const device = computed(() => (deviceId.value ? devices.value.find((item) => item.id === deviceId.value) : undefined));
const channel = computed(() => (channelId.value ? channels.value.find((item) => item.id === channelId.value) : undefined));
const property = computed(() => (propertyId.value ? properties.value.find((item) => item.id === propertyId.value) : undefined));

// A scene can outlive the device it sets: the row says so rather than showing a broken path
const isMissing = computed<boolean>(
	(): boolean => (!!deviceId.value && !device.value) || (!!channelId.value && !channel.value) || (!!propertyId.value && !property.value)
);

const domain = computed(() => deviceCategoryDomain(device.value?.category as DevicesModuleDeviceCategory | undefined));

const title = computed<string>((): string => {
	if (!deviceId.value) {
		return props.label;
	}

	return device.value?.name ?? t('scenes.actions.unknownDevice');
});

const path = computed<string | null>((): string | null => {
	if (!deviceId.value) {
		return null;
	}

	const channelName = channelId.value ? (channel.value?.name ?? t('scenes.actions.unknownChannel')) : null;
	const propertyName = propertyId.value
		? property.value
			? (property.value.name ?? t(`devicesModule.categories.channelsProperties.${property.value.category}`))
			: t('scenes.actions.unknownProperty')
		: null;

	// A channel named like its device (a single-channel device) adds nothing to the path
	const parts = [channelName && channelName.toLowerCase() !== title.value.toLowerCase() ? channelName : null, propertyName];

	return parts.filter((part): part is string => part !== null).join(' › ') || null;
});

onBeforeMount(async (): Promise<void> => {
	if (!devicesLoaded.value) {
		await fetchDevices().catch((): void => undefined);
	}

	// A deleted device has no channels to fetch
	if (!device.value) {
		return;
	}

	try {
		await fetchChannels();
	} catch {
		return;
	}

	if (channelId.value && channel.value) {
		await fetchProperties().catch((): void => undefined);
	}
});
</script>
