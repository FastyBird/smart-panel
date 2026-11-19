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
					v-if="canPlay"
					v-model="selectedProfile"
					size="small"
					class="ml-auto w-40"
					:aria-label="t('camerasModule.profiles.selector')"
				>
					<el-option
						v-for="item in availableProfiles"
						:key="item.id"
						:value="item.id"
						:label="item.id"
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
				v-if="isAdmin"
				:to="settingsRoute"
			>
				<el-link type="primary">
					{{ t('camerasModule.buttons.openSettings') }}
				</el-link>
			</router-link>
		</empty-state>

		<empty-state
			v-else-if="loadError !== null"
			icon="mdi:cctv-off"
			:description="t('camerasModule.section.noStream')"
		/>

		<div
			v-else-if="camera !== null"
			class="flex flex-col gap-4"
		>
			<camera-player
				v-if="canPlay"
				:key="device.id"
				:device-id="device.id"
				:profile="selectedProfile"
				variant="large"
			/>

			<div
				v-else
				class="camera-section__snapshot"
			>
				<img
					v-if="snapshot.url.value !== null"
					:src="snapshot.url.value"
					alt=""
					class="camera-section__image"
				/>

				<el-text
					class="block mt-2"
					type="info"
					data-test-id="camera-section-reason"
				>
					{{ unavailableSentence }}
				</el-text>
			</div>

			<camera-profiles-table :camera="camera" />
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElLink, ElOption, ElSelect, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { EmptyState, injectStoresManager } from '../../../common';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { useSession } from '../../auth/composables/useSession';
import { RouteNames as ConfigRouteNames } from '../../config/config.constants';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { CamerasApiException } from '../cameras.exceptions';
import { isModuleDisabledError } from '../cameras.utils';
import { useCameraSnapshot } from '../composables/useCameraSnapshot';
import type { ICamera, ICameraProfile } from '../store';
import { camerasStoreKey } from '../store/keys';

import type { ICameraDeviceSectionProps } from './camera-device-section.types';
import CameraPlayer from './camera-player.vue';
import { cameraReasonSentenceKey } from './camera-profiles-table.types';
import CameraProfilesTable from './camera-profiles-table.vue';

defineOptions({
	name: 'CameraDeviceSection',
});

const props = defineProps<ICameraDeviceSectionProps>();

const { t } = useI18n();

const camerasStore = injectStoresManager().getStore(camerasStoreKey);
const { profile: currentUser } = useSession();

const loadError = ref<'module_disabled' | 'failed' | null>(null);
const selectedProfile = ref<string | null>(null);

const camera = computed<ICamera | null>(() => camerasStore.findById(props.device.id));

const availableProfiles = computed<ICameraProfile[]>(() => camera.value?.profiles.filter((profile) => profile.available) ?? []);

// A camera with live view turned off or without an available profile never starts a session.
const canPlay = computed<boolean>(() => camera.value !== null && camera.value.liveView && availableProfiles.value.length > 0);

const isAdmin = computed<boolean>(
	() => currentUser.value?.role === UsersModuleUserRole.admin || currentUser.value?.role === UsersModuleUserRole.owner
);

const settingsRoute = { name: ConfigRouteNames.CONFIG_MODULE_EDIT, params: { module: CAMERAS_MODULE_NAME } };

const snapshot = useCameraSnapshot(() => props.device.id, { active: () => camera.value !== null && !canPlay.value });

const unavailableSentence = computed<string>(() => {
	const reason = camera.value?.profiles.find((profile) => !profile.available)?.unavailableReason ?? null;

	return reason !== null ? t(cameraReasonSentenceKey(reason)) : t('camerasModule.section.noLiveView');
});

const load = async (): Promise<void> => {
	loadError.value = null;

	try {
		await camerasStore.get({ deviceId: props.device.id });
	} catch (error) {
		const code = error instanceof CamerasApiException ? error.code : null;

		loadError.value = code !== null && isModuleDisabledError(code, { message: (error as Error).message }) ? 'module_disabled' : 'failed';
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

<style scoped>
.camera-section__image {
	display: block;
	width: 100%;
	max-height: 360px;
	object-fit: contain;
	background-color: var(--el-fill-color-darker);
	border-radius: var(--el-border-radius-base);
}
</style>
