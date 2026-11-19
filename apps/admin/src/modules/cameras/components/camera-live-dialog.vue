<template>
	<el-dialog
		:model-value="camera !== null"
		:title="camera?.name ?? ''"
		:fullscreen="isTabletLandscape"
		width="min(960px, 95vw)"
		destroy-on-close
		append-to-body
		data-test-id="camera-live-dialog"
		@update:model-value="onDialogChange"
	>
		<template v-if="camera !== null">
			<div class="camera-live-dialog__toolbar">
				<el-segmented
					v-if="profileOptions.length > 1"
					:model-value="selectedProfile ?? undefined"
					:options="profileOptions"
					:aria-label="t('camerasModule.profiles.selector')"
					data-test-id="camera-live-dialog-profiles"
					@update:model-value="onProfileChange"
				/>

				<div class="camera-live-dialog__actions">
					<el-button
						:loading="snapshot.loading.value"
						data-test-id="camera-live-dialog-snapshot"
						@click="onSnapshot"
					>
						<template #icon>
							<icon icon="mdi:camera-outline" />
						</template>
						{{ t('camerasModule.buttons.snapshot') }}
					</el-button>

					<el-button
						data-test-id="camera-live-dialog-mute"
						@click="muted = !muted"
					>
						<template #icon>
							<icon :icon="muted ? 'mdi:volume-off' : 'mdi:volume-high'" />
						</template>
						{{ muted ? t('camerasModule.buttons.unmute') : t('camerasModule.buttons.mute') }}
					</el-button>

					<el-button
						data-test-id="camera-live-dialog-fullscreen"
						@click="onFullscreen"
					>
						<template #icon>
							<icon icon="mdi:fullscreen" />
						</template>
						{{ t('camerasModule.buttons.fullScreen') }}
					</el-button>

					<el-select
						v-if="otherCameras.length > 0"
						:model-value="camera.deviceId"
						:aria-label="t('camerasModule.dialog.switchCamera')"
						:placeholder="t('camerasModule.dialog.switchCamera')"
						class="camera-live-dialog__switcher"
						data-test-id="camera-live-dialog-switcher"
						@update:model-value="onSwitchCamera"
					>
						<el-option
							v-for="other in otherCameras"
							:key="other.deviceId"
							:value="other.deviceId"
							:label="other.name"
						/>
					</el-select>
				</div>
			</div>

			<camera-player
				:key="camera.deviceId"
				ref="player"
				:device-id="camera.deviceId"
				:profile="selectedProfile"
				variant="large"
				auto-start
				:muted="muted"
				@mime-change="mime = $event"
			/>

			<p
				class="camera-live-dialog__transport"
				data-test-id="camera-live-dialog-transport"
			>
				{{ transport }}
			</p>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElMessage, ElOption, ElSegmented, ElSelect } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useCameraSnapshot } from '../composables/useCameraSnapshot';
import { describeMime } from '../live/codecs';
import type { ICamera, ICameraProfile } from '../store';

import type { ICameraLiveDialogProps } from './camera-live-dialog.types';
import CameraPlayer from './camera-player.vue';

defineOptions({
	name: 'CameraLiveDialog',
});

const props = defineProps<ICameraLiveDialogProps>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | null): void;
}>();

const { t } = useI18n();

const player = ref<InstanceType<typeof CameraPlayer> | null>(null);
const selectedProfile = ref<string | null>(null);
const muted = ref(true);
const mime = ref<string | null>(null);
const isTabletLandscape = ref(false);

const camera = computed<ICamera | null>(() => props.cameras.find((item) => item.deviceId === props.modelValue) ?? null);

const availableProfiles = computed<ICameraProfile[]>(() => camera.value?.profiles.filter((profile) => profile.available) ?? []);

const profileOptions = computed(() =>
	availableProfiles.value.map((profile) => ({
		label: profile.width != null && profile.height != null ? `${profile.width}\u00d7${profile.height}` : profile.id,
		value: profile.id,
	}))
);

const otherCameras = computed<ICamera[]>(() => props.cameras.filter((item) => item.deviceId !== props.modelValue));

const currentProfile = computed<ICameraProfile | null>(() => availableProfiles.value.find((profile) => profile.id === selectedProfile.value) ?? null);

// Used only for the Snapshot button: it never refreshes on its own.
const snapshot = useCameraSnapshot(() => camera.value?.deviceId ?? '', {
	profile: () => selectedProfile.value,
	refreshMs: null,
	active: () => false,
});

const transport = computed<string>(() => {
	const codecs = mime.value !== null ? describeMime(mime.value) : { video: null, audio: null };
	const profile = currentProfile.value;
	const resolution = profile?.width != null && profile.height != null ? `${profile.width}×${profile.height}` : null;
	const fps = profile?.fps != null ? t('camerasModule.dialog.fps', { fps: profile.fps }) : null;

	return ['MSE', codecs.video, codecs.audio, resolution, fps].filter((part): part is string => part !== null).join(' · ');
});

const stopPlayer = (): void => {
	player.value?.stop();
};

const close = (): void => {
	stopPlayer();
	emit('update:modelValue', null);
};

const onDialogChange = (open: boolean): void => {
	if (!open) {
		close();
	}
};

const onProfileChange = (value: string | number | boolean): void => {
	selectedProfile.value = String(value);
};

const onSwitchCamera = (deviceId: string): void => {
	emit('update:modelValue', deviceId);
};

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const onSnapshot = async (): Promise<void> => {
	if (camera.value === null) {
		return;
	}

	await snapshot.reload({ hq: true });

	// A failed reload keeps the previous image; downloading it would pass it off as a fresh one.
	if (snapshot.error.value !== null || snapshot.url.value === null) {
		ElMessage.error(t('camerasModule.dialog.snapshotFailed'));

		return;
	}

	const extension = EXTENSIONS[snapshot.mimeType.value ?? ''] ?? 'jpg';
	const link = document.createElement('a');

	link.href = snapshot.url.value;
	link.download = `${camera.value.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
	link.click();
};

const onFullscreen = (): void => {
	const element = (player.value?.$el ?? null) as HTMLElement | null;

	void element?.requestFullscreen?.()?.catch((): void => undefined);
};

watch(
	camera,
	(next, previous) => {
		// The open camera was removed: clear the model so the stale id cannot reopen the dialog.
		if (next === null && props.modelValue !== null) {
			emit('update:modelValue', null);

			return;
		}

		if (next?.deviceId !== previous?.deviceId) {
			mime.value = null;
		}

		if (!next?.profiles.some((profile) => profile.available && profile.id === selectedProfile.value)) {
			selectedProfile.value = next?.profiles.find((profile) => profile.available)?.id ?? null;
		}
	},
	{ immediate: true }
);

// A parent that sets the model to `null` closes the dialog without `close`; the player is still mounted for this flush.
watch(
	() => props.modelValue,
	(next) => {
		if (next === null) {
			stopPlayer();
		}
	},
	{ flush: 'pre' }
);

let query: MediaQueryList | null = null;

const onQueryChange = (event: MediaQueryListEvent): void => {
	isTabletLandscape.value = event.matches;
};

onMounted(() => {
	if (typeof window.matchMedia !== 'function') {
		return;
	}

	query = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)');
	isTabletLandscape.value = query.matches;
	query.addEventListener('change', onQueryChange);
});

onBeforeUnmount(() => {
	query?.removeEventListener('change', onQueryChange);
});
</script>

<style scoped>
.camera-live-dialog__toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 12px;
}

.camera-live-dialog__actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
}

.camera-live-dialog__switcher {
	width: 180px;
}

.camera-live-dialog__transport {
	margin: 8px 0 0;
	font-size: var(--el-font-size-small);
	color: var(--el-text-color-secondary);
}
</style>
