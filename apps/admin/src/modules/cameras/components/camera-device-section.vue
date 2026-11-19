<template>
	<el-card
		class="mt-2 mb-2"
		shadow="never"
		data-test-id="camera-device-section"
	>
		<template #header>
			<div class="flex items-center gap-2">
				<icon icon="mdi:cctv" />
				<strong>{{ t('camerasModule.section.heading') }}</strong>

				<el-select
					v-if="liveAvailable"
					v-model="selectedProfile"
					size="small"
					class="ml-auto w-40"
					:aria-label="t('camerasModule.profiles.selector')"
				>
					<el-option
						v-for="item in availableProfiles"
						:key="item.id"
						:value="item.id"
						:label="cameraProfileLabel(item)"
					/>
				</el-select>
			</div>
		</template>

		<empty-state
			v-if="loadError === 'module_disabled'"
			icon="mdi:power-plug-off-outline"
			:description="t('camerasModule.states.moduleDisabled')"
		>
			<router-link
				v-if="canOpenSettings"
				:to="settingsRoute"
			>
				<el-link type="primary">
					{{ t('camerasModule.buttons.openSettings') }}
				</el-link>
			</router-link>
		</empty-state>

		<empty-state
			v-else-if="loadError === 'not_found'"
			icon="mdi:cctv-off"
			:description="t('camerasModule.section.noStream')"
		/>

		<empty-state
			v-else-if="loadError === 'failed'"
			icon="mdi:alert-circle-outline"
			:description="t('camerasModule.section.loadFailed')"
		>
			<el-button
				data-test-id="camera-section-retry"
				@click="load"
			>
				{{ t('camerasModule.buttons.retry') }}
			</el-button>
		</empty-state>

		<div
			v-else-if="camera !== null"
			class="flex flex-col gap-4"
		>
			<camera-player
				:key="device.id"
				ref="player"
				:device-id="device.id"
				:profile="selectedProfile"
				:snapshot-active="active"
				variant="large"
			/>

			<camera-profiles-table :camera="camera" />
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElLink, ElOption, ElSelect } from 'element-plus';

import { Icon } from '@iconify/vue';

import { EmptyState, injectStoresManager } from '../../../common';
import { CamerasApiException } from '../cameras.exceptions';
import { cameraProfileLabel, isLiveViewAvailable, isModuleDisabledException } from '../cameras.utils';
import { useCamerasSettingsLink } from '../composables/useCamerasSettingsLink';
import type { ICamera, ICameraProfile } from '../store';
import { camerasStoreKey } from '../store/keys';

import type { ICameraDeviceSectionProps } from './camera-device-section.types';
import CameraPlayer from './camera-player.vue';
import CameraProfilesTable from './camera-profiles-table.vue';

defineOptions({
	name: 'CameraDeviceSection',
});

const props = withDefaults(defineProps<ICameraDeviceSectionProps>(), {
	active: true,
});

const { t } = useI18n();

const camerasStore = injectStoresManager().getStore(camerasStoreKey);
const { canOpenSettings, settingsRoute } = useCamerasSettingsLink();

const player = ref<InstanceType<typeof CameraPlayer> | null>(null);

const loadError = ref<'module_disabled' | 'not_found' | 'failed' | null>(null);
const selectedProfile = ref<string | null>(null);

const camera = computed<ICamera | null>(() => camerasStore.findById(props.device.id));

const availableProfiles = computed<ICameraProfile[]>(() => camera.value?.profiles.filter((profile) => profile.available) ?? []);

// The player itself never starts a session for such a camera and says why; the selector would offer nothing.
const liveAvailable = computed<boolean>(() => isLiveViewAvailable(camera.value));

let loadId = 0;

const load = async (): Promise<void> => {
	const id = ++loadId;

	loadError.value = null;

	try {
		await camerasStore.get({ deviceId: props.device.id });
	} catch (error) {
		// A response for a device the section has since switched away from changes nothing.
		if (id !== loadId) {
			return;
		}

		if (isModuleDisabledException(error)) {
			loadError.value = 'module_disabled';
		} else if (error instanceof CamerasApiException && error.code === 404) {
			loadError.value = 'not_found';
		} else {
			loadError.value = 'failed';
		}
	}
};

watch(
	() => props.device.id,
	() => {
		selectedProfile.value = null;
		void load();
	},
	{ immediate: true }
);

// The overview tab stays mounted while another tab is open; a live view must not keep streaming behind it.
watch(
	() => props.active,
	(active) => {
		if (!active) {
			player.value?.stop();
		}
	}
);

watch(
	availableProfiles,
	(profiles) => {
		if (!profiles.some((profile) => profile.id === selectedProfile.value)) {
			selectedProfile.value = profiles[0]?.id ?? null;
		}
	},
	{ immediate: true }
);
</script>
