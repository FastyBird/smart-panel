<template>
	<div
		class="camera-player"
		:class="[`camera-player--${variant}`]"
		data-test-id="camera-player"
	>
		<img
			v-if="snapshot.url.value !== null"
			:src="snapshot.url.value"
			alt=""
			class="camera-player__snapshot"
			:class="{ 'is-dimmed': isConnecting && !reconnect }"
		/>

		<video
			v-show="state === 'playing'"
			ref="video"
			class="camera-player__video"
			autoplay
			playsinline
			:muted="muted"
			@play="paused = false"
			@playing="paused = false"
			@pause="paused = true"
			@emptied="paused = true"
		/>

		<div
			v-if="state === 'snapshot'"
			class="camera-player__overlay camera-player__overlay--corner"
		>
			<el-tag
				v-if="snapshotAge !== null"
				size="small"
				effect="dark"
				class="camera-player__age"
				data-test-id="camera-player-age"
			>
				{{ t('camerasModule.states.snapshotAge', { seconds: snapshotAge }) }}
			</el-tag>

			<el-button
				circle
				type="primary"
				size="large"
				class="camera-player__play"
				:aria-label="t('camerasModule.states.play')"
				data-test-id="camera-player-play"
				@click="start"
			>
				<el-icon :size="24">
					<icon icon="mdi:play" />
				</el-icon>
			</el-button>
		</div>

		<template v-else-if="isConnecting">
			<div
				v-if="!reconnect"
				class="camera-player__overlay"
				data-test-id="camera-player-connecting"
			>
				<el-icon
					class="is-loading"
					:size="32"
				>
					<icon icon="mdi:loading" />
				</el-icon>
			</div>
		</template>

		<template v-else-if="state === 'playing'">
			<el-tag
				type="danger"
				size="small"
				effect="dark"
				class="camera-player__live"
				data-test-id="camera-player-live"
			>
				{{ t('camerasModule.states.live') }}
			</el-tag>

			<div
				v-if="paused"
				class="camera-player__overlay"
			>
				<el-button
					circle
					type="primary"
					size="large"
					:aria-label="t('camerasModule.states.play')"
					data-test-id="camera-player-resume"
					@click="onResume"
				>
					<el-icon :size="24">
						<icon icon="mdi:play" />
					</el-icon>
				</el-button>
			</div>
		</template>

		<div
			v-else
			class="camera-player__overlay camera-player__overlay--message"
			:data-test-id="`camera-player-${state}`"
		>
			<icon
				:icon="messageIcon"
				class="camera-player__message-icon"
			/>

			<strong class="camera-player__title">{{ title }}</strong>

			<span
				v-if="detail !== null"
				class="camera-player__detail"
			>
				{{ detail }}
			</span>

			<div
				v-if="showRetry || showSettingsLink"
				class="camera-player__actions"
			>
				<el-button
					v-if="showRetry"
					size="small"
					data-test-id="camera-player-retry"
					@click="retry"
				>
					{{ t('camerasModule.buttons.retry') }}
				</el-button>

				<router-link
					v-if="showSettingsLink"
					:to="settingsRoute"
				>
					<el-link
						type="primary"
						:underline="'never'"
						data-test-id="camera-player-settings"
					>
						{{ t('camerasModule.buttons.openSettings') }}
					</el-link>
				</router-link>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElLink, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../common';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { useSession } from '../../auth/composables/useSession';
import { RouteNames as ConfigRouteNames } from '../../config/config.constants';
import { CAMERAS_MODULE_NAME, SNAPSHOT_REFRESH_MS } from '../cameras.constants';
import { useCameraSnapshot } from '../composables/useCameraSnapshot';
import { useLiveView } from '../composables/useLiveView';
import type { LiveViewState } from '../live/live-view-machine';
import { relayStatusStoreKey } from '../store/keys';

import type { ICameraPlayerProps } from './camera-player.types';

defineOptions({
	name: 'CameraPlayer',
});

const props = withDefaults(defineProps<ICameraPlayerProps>(), {
	profile: null,
	autoStart: false,
	muted: true,
	snapshotActive: true,
});

const emit = defineEmits<{
	(e: 'state-change', state: LiveViewState): void;
	(e: 'mime-change', mime: string | null): void;
}>();

const { t } = useI18n();

const relayStatusStore = injectStoresManager().getStore(relayStatusStoreKey);
const { profile: currentUser } = useSession();

const video = ref<HTMLVideoElement | null>(null);
// A video that has not started is paused; the `play` event clears it, so blocked autoplay keeps it set.
const paused = ref(true);

const { state, retryInMs, reconnect, lastSeen, mime, start, stop, retry } = useLiveView({
	deviceId: toRef(props, 'deviceId'),
	profile: () => props.profile ?? null,
	video,
	autoStart: props.autoStart,
});

const snapshot = useCameraSnapshot(() => props.deviceId, {
	profile: () => props.profile ?? null,
	refreshMs: props.variant === 'tile' ? SNAPSHOT_REFRESH_MS : null,
	active: () => props.snapshotActive && state.value !== 'playing',
});

const isConnecting = computed<boolean>(() => state.value === 'connecting' || state.value === 'requesting');

const snapshotAge = computed<number | null>(() =>
	snapshot.ageSeconds.value !== null && snapshot.ageSeconds.value > 0 ? snapshot.ageSeconds.value : null
);

const isAdmin = computed<boolean>(
	() => currentUser.value?.role === UsersModuleUserRole.admin || currentUser.value?.role === UsersModuleUserRole.owner
);

const settingsRoute = { name: ConfigRouteNames.CONFIG_MODULE_EDIT, params: { module: CAMERAS_MODULE_NAME } };

const sessionLimit = computed<number | null>(() => {
	const sessions = relayStatusStore.status?.sessions;

	if (!sessions) {
		return null;
	}

	return state.value === 'camera_limit' ? Math.min(sessions.maxPerCamera, sessions.max) : sessions.max;
});

const relayReason = computed<string | null>(() => relayStatusStore.status?.relay.reason ?? null);

const MESSAGE_ICONS: Partial<Record<LiveViewState, string>> = {
	codec_unsupported: 'mdi:video-off-outline',
	offline: 'mdi:video-off-outline',
	relay_unavailable: 'mdi:server-network-off',
	camera_limit: 'mdi:account-multiple-remove-outline',
	total_limit: 'mdi:account-multiple-remove-outline',
	module_disabled: 'mdi:power-plug-off-outline',
	error: 'mdi:alert-circle-outline',
};

const messageIcon = computed<string>(() => MESSAGE_ICONS[state.value] ?? 'mdi:alert-circle-outline');

const title = computed<string>(() => {
	switch (state.value) {
		case 'codec_unsupported':
			return t('camerasModule.states.codecUnsupported');
		case 'offline':
			return t('camerasModule.states.offline');
		case 'relay_unavailable':
			return t('camerasModule.states.relayUnavailable');
		case 'camera_limit':
			return sessionLimit.value === null
				? t('camerasModule.states.cameraLimitNoMax')
				: t('camerasModule.states.cameraLimit', { max: sessionLimit.value });
		case 'total_limit':
			return sessionLimit.value === null
				? t('camerasModule.states.totalLimitNoMax')
				: t('camerasModule.states.totalLimit', { max: sessionLimit.value });
		case 'module_disabled':
			return t('camerasModule.states.moduleDisabled');
		default:
			return t('camerasModule.states.error');
	}
});

const detail = computed<string | null>(() => {
	switch (state.value) {
		case 'offline':
			return lastSeen.value !== null ? t('camerasModule.states.lastSeen', { time: lastSeen.value.toLocaleString() }) : null;
		case 'relay_unavailable':
			return relayReason.value !== null ? t(`camerasModule.relayReasons.${relayReason.value}`) : null;
		case 'error':
			return retryInMs.value !== null ? t('camerasModule.states.retryingIn', { seconds: Math.ceil(retryInMs.value / 1000) }) : null;
		default:
			return null;
	}
});

const showRetry = computed<boolean>(
	() =>
		state.value === 'relay_unavailable' ||
		state.value === 'camera_limit' ||
		state.value === 'total_limit' ||
		(state.value === 'error' && retryInMs.value === null)
);

const showSettingsLink = computed<boolean>(() => (state.value === 'relay_unavailable' || state.value === 'module_disabled') && isAdmin.value);

const onResume = (): void => {
	// Autoplay was blocked; a click is the user gesture that allows playback.
	void video.value?.play()?.catch((): void => undefined);
};

watch(state, (next) => emit('state-change', next));
watch(mime, (next) => emit('mime-change', next));

watch(
	() => props.profile,
	() => {
		if (state.value === 'codec_unsupported') {
			start();
		}
	}
);

defineExpose({ start, stop, retry, video });
</script>

<style scoped>
.camera-player {
	position: relative;
	width: 100%;
	aspect-ratio: 16 / 9;
	overflow: hidden;
	background-color: var(--el-fill-color-darker);
	border-radius: var(--el-border-radius-base);
	color: var(--el-color-white);
}

.camera-player__snapshot,
.camera-player__video {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: contain;
}

.camera-player__snapshot.is-dimmed {
	opacity: 0.4;
}

.camera-player__overlay {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.camera-player__overlay--corner {
	align-items: flex-end;
	justify-content: flex-end;
	gap: var(--el-component-size-small, 8px);
	padding: 8px;
}

.camera-player__overlay--message {
	flex-direction: column;
	gap: 6px;
	padding: 12px;
	text-align: center;
	background-color: var(--el-overlay-color-lighter);
}

.camera-player__message-icon {
	font-size: 28px;
}

.camera-player__actions {
	display: flex;
	align-items: center;
	gap: 12px;
}

.camera-player__live {
	position: absolute;
	top: 8px;
	left: 8px;
}

.camera-player__age {
	margin-right: auto;
}

.camera-player--tile .camera-player__message-icon {
	font-size: 20px;
}
</style>
