<template>
	<div
		v-if="loadError === 'module_disabled'"
		data-test-id="cameras-grid-module-disabled"
	>
		<empty-state
			:description="t('camerasModule.states.moduleDisabled')"
			icon="mdi:power-plug-off-outline"
		>
			<router-link
				v-if="isAdmin"
				:to="settingsRoute"
			>
				<el-link
					type="primary"
					:underline="'never'"
				>
					{{ t('camerasModule.buttons.openSettings') }}
				</el-link>
			</router-link>
		</empty-state>
	</div>

	<div
		v-else-if="loadError === 'failed' && cameras.length === 0"
		data-test-id="cameras-grid-load-failed"
	>
		<empty-state
			:description="t('camerasModule.grid.loadFailed')"
			icon="mdi:alert-circle-outline"
		/>
	</div>

	<div
		v-else-if="loaded && cameras.length === 0"
		data-test-id="cameras-grid-empty"
	>
		<empty-state
			:description="t('camerasModule.grid.empty')"
			icon="mdi:cctv"
		/>
	</div>

	<div
		v-else-if="cameras.length > 0"
		class="cameras-grid"
	>
		<div class="cameras-grid__filters">
			<div
				class="cameras-grid__chips"
				role="group"
				:aria-label="t('camerasModule.grid.spaces')"
			>
				<el-check-tag
					:checked="selectedRoom === null"
					data-test-id="cameras-grid-chip-all"
					@change="selectedRoom = null"
				>
					{{ t('camerasModule.grid.allSpaces') }}
				</el-check-tag>

				<el-check-tag
					v-for="room in rooms"
					:key="room.id"
					:checked="selectedRoom === room.id"
					data-test-id="cameras-grid-chip"
					@change="selectedRoom = room.id"
				>
					{{ room.name }}
				</el-check-tag>
			</div>

			<relay-status-chip :status="relayStatusStore.status" />
		</div>

		<div class="cameras-grid__tiles">
			<camera-tile
				v-for="camera in visibleCameras"
				:key="camera.deviceId"
				:camera="camera"
				:room-name="roomNameOf(camera)"
				@open="openId = $event"
			/>
		</div>

		<camera-live-dialog
			v-model="openId"
			:cameras="cameras"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCheckTag, ElLink } from 'element-plus';

import { EmptyState, injectStoresManager } from '../../../common';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { useSession } from '../../auth/composables/useSession';
import { RouteNames as ConfigRouteNames } from '../../config/config.constants';
import { devicesStoreKey } from '../../devices/store/keys';
import { spacesStoreKey } from '../../spaces/store/keys';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { CamerasApiException } from '../cameras.exceptions';
import { isModuleDisabledError } from '../cameras.utils';
import type { ICamera } from '../store';
import { camerasStoreKey, relayStatusStoreKey } from '../store/keys';

import CameraLiveDialog from './camera-live-dialog.vue';
import CameraTile from './camera-tile.vue';
import RelayStatusChip from './relay-status-chip.vue';

defineOptions({
	name: 'CamerasGrid',
});

const { t } = useI18n();

const storesManager = injectStoresManager();
const camerasStore = storesManager.getStore(camerasStoreKey);
const relayStatusStore = storesManager.getStore(relayStatusStoreKey);
const devicesStore = storesManager.getStore(devicesStoreKey);
const spacesStore = storesManager.getStore(spacesStoreKey);

const { profile: currentUser } = useSession();

const loaded = ref(false);
const loadError = ref<'module_disabled' | 'failed' | null>(null);
const selectedRoom = ref<string | null>(null);
const openId = ref<string | null>(null);

const isAdmin = computed<boolean>(
	() => currentUser.value?.role === UsersModuleUserRole.admin || currentUser.value?.role === UsersModuleUserRole.owner
);

const settingsRoute = { name: ConfigRouteNames.CONFIG_MODULE_EDIT, params: { module: CAMERAS_MODULE_NAME } };

const cameras = computed<ICamera[]>(() => camerasStore.findAll());

const roomIdOf = (camera: ICamera): string | null => devicesStore.findById(camera.deviceId)?.roomId ?? null;

const roomNameOf = (camera: ICamera): string | null => {
	const roomId = roomIdOf(camera);

	return roomId !== null ? (spacesStore.findById(roomId)?.name ?? null) : null;
};

const rooms = computed<{ id: string; name: string }[]>(() => {
	const found = new Map<string, string>();

	for (const camera of cameras.value) {
		const roomId = roomIdOf(camera);
		const name = roomId !== null ? (spacesStore.findById(roomId)?.name ?? null) : null;

		if (roomId !== null && name !== null) {
			found.set(roomId, name);
		}
	}

	return [...found.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
});

const visibleCameras = computed<ICamera[]>(() =>
	selectedRoom.value === null ? cameras.value : cameras.value.filter((camera) => roomIdOf(camera) === selectedRoom.value)
);

// A refresh can leave the selected room without cameras; show everything again then.
watch(rooms, (next) => {
	if (selectedRoom.value !== null && !next.some((room) => room.id === selectedRoom.value)) {
		selectedRoom.value = null;
	}
});

const load = async (): Promise<void> => {
	loadError.value = null;

	try {
		await camerasStore.fetch();
	} catch (error) {
		loadError.value =
			error instanceof CamerasApiException && error.code === 404 && isModuleDisabledError(error.code, { message: error.message })
				? 'module_disabled'
				: 'failed';
		loaded.value = true;

		return;
	}

	loaded.value = true;

	// The rooms only decorate the grid; the cameras show without them.
	await Promise.allSettled([devicesStore.fetch(), spacesStore.fetch()]);
};

let releasePolling: (() => void) | null = null;

onMounted(() => {
	releasePolling = relayStatusStore.startPolling();

	void load();
});

onBeforeUnmount(() => {
	releasePolling?.();
	releasePolling = null;
});
</script>

<style scoped>
.cameras-grid {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.cameras-grid__filters {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.cameras-grid__chips {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.cameras-grid__tiles {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	gap: 16px;
}

@media (min-width: 720px) and (max-width: 1279px) {
	.cameras-grid__tiles {
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	}
}

@media (max-width: 359px) {
	.cameras-grid__tiles {
		grid-template-columns: 1fr;
	}
}
</style>
