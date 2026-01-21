import { ref, computed, type ComputedRef, type Ref, watch } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';
import type { ISpace } from '../store';

import type { components } from '../../../openapi';

type MediaStateData = components['schemas']['SpacesModuleDataMediaState'];
type MediaRoleStateData = components['schemas']['SpacesModuleDataMediaRoleState'];
type OtherMediaStateData = components['schemas']['SpacesModuleDataOtherMediaState'];

/**
 * Aggregated state for media devices assigned to a role.
 */
export interface IMediaRoleState {
	role: string;
	isOn: boolean;
	isOnMixed: boolean;
	volume: number | null;
	isVolumeMixed: boolean;
	isMuted: boolean;
	isMutedMixed: boolean;
	devicesCount: number;
	devicesOn: number;
}

/**
 * Aggregated state for unassigned media devices.
 */
export interface IOtherMediaState {
	isOn: boolean;
	isOnMixed: boolean;
	volume: number | null;
	isVolumeMixed: boolean;
	isMuted: boolean;
	isMutedMixed: boolean;
	devicesCount: number;
	devicesOn: number;
}

/**
 * Media state for a space, including mode detection and per-role breakdown.
 */
export interface IMediaState {
	hasMedia: boolean;
	anyOn: boolean;
	allOff: boolean;
	averageVolume: number | null;
	anyMuted: boolean;
	devicesCount: number;
	devicesByRole: Record<string, number>;
	lastAppliedMode: string | null;
	lastAppliedVolume: number | null;
	lastAppliedMuted: boolean | null;
	lastAppliedAt: Date | null;
	detectedMode: string | null;
	modeConfidence: 'exact' | 'approximate' | 'none';
	modeMatchPercentage: number | null;
	roles: Record<string, IMediaRoleState>;
	other: IOtherMediaState;
}

/**
 * Return type for the useSpaceMediaState composable.
 */
export interface IUseSpaceMediaState {
	mediaState: ComputedRef<IMediaState | null>;
	isLoading: ComputedRef<boolean>;
	error: Ref<string | null>;
	fetchMediaState: () => Promise<IMediaState | null>;
	hasMedia: ComputedRef<boolean>;
	anyOn: ComputedRef<boolean>;
	allOff: ComputedRef<boolean>;
}

const transformMediaRoleState = (role: string, data: MediaRoleStateData): IMediaRoleState => ({
	role,
	isOn: data.is_on ?? false,
	isOnMixed: data.is_on_mixed ?? false,
	volume: data.volume ?? null,
	isVolumeMixed: data.is_volume_mixed ?? false,
	isMuted: data.is_muted ?? false,
	isMutedMixed: data.is_muted_mixed ?? false,
	devicesCount: data.devices_count ?? 0,
	devicesOn: data.devices_on ?? 0,
});

const transformOtherMediaState = (data?: OtherMediaStateData): IOtherMediaState => ({
	isOn: data?.is_on ?? false,
	isOnMixed: data?.is_on_mixed ?? false,
	volume: data?.volume ?? null,
	isVolumeMixed: data?.is_volume_mixed ?? false,
	isMuted: data?.is_muted ?? false,
	isMutedMixed: data?.is_muted_mixed ?? false,
	devicesCount: data?.devices_count ?? 0,
	devicesOn: data?.devices_on ?? 0,
});

const transformMediaState = (data: MediaStateData): IMediaState => {
	const roles: Record<string, IMediaRoleState> = {};
	if (data.roles) {
		for (const [role, state] of Object.entries(data.roles)) {
			if (state) {
				roles[role] = transformMediaRoleState(role, state as MediaRoleStateData);
			}
		}
	}

	return {
		hasMedia: data.has_media ?? false,
		anyOn: data.any_on ?? false,
		allOff: data.all_off ?? false,
		averageVolume: data.average_volume ?? null,
		anyMuted: data.any_muted ?? false,
		devicesCount: data.devices_count ?? 0,
		devicesByRole: data.devices_by_role ?? {},
		lastAppliedMode: data.last_applied_mode ?? null,
		lastAppliedVolume: data.last_applied_volume ?? null,
		lastAppliedMuted: data.last_applied_muted ?? null,
		lastAppliedAt: data.last_applied_at ? new Date(data.last_applied_at) : null,
		detectedMode: data.detected_mode ?? null,
		modeConfidence: (data.mode_confidence as IMediaState['modeConfidence']) ?? 'none',
		modeMatchPercentage: data.mode_match_percentage ?? null,
		roles,
		other: transformOtherMediaState(data.other),
	};
};

/**
 * Composable for fetching and managing media state for a space.
 *
 * Mirrors the climate/lighting composables with stale-request protection and
 * resets when the active space changes.
 *
 * @param spaceId - Reactive reference to the space ID
 * @returns Media state, loading/error flags, and convenience computed properties
 */
export const useSpaceMediaState = (spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceMediaState => {
	const backend = useBackend();

	const mediaStateData = ref<IMediaState | null>(null);
	const loadingCount = ref(0);
	const isLoading = computed(() => loadingCount.value > 0);
	const error = ref<string | null>(null);
	let spaceGeneration = 0;

	const mediaState = computed(() => mediaStateData.value);

	const hasMedia = computed(() => mediaStateData.value?.hasMedia ?? false);
	const anyOn = computed(() => mediaStateData.value?.anyOn ?? false);
	const allOff = computed(() => mediaStateData.value?.allOff ?? false);

	const fetchMediaState = async (): Promise<IMediaState | null> => {
		const currentSpaceId = spaceId.value;
		if (!currentSpaceId) return null;

		const requestGeneration = spaceGeneration;
		loadingCount.value++;
		error.value = null;

		try {
			const { data, error: apiError } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media`,
				{ params: { path: { id: currentSpaceId } } }
			);

			if (apiError || !data) {
				throw new Error('Failed to fetch media state');
			}

			if (spaceId.value !== currentSpaceId || spaceGeneration !== requestGeneration) {
				return null;
			}

			mediaStateData.value = transformMediaState(data.data);
			return mediaStateData.value;
		} catch (e) {
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration) {
				error.value = e instanceof Error ? e.message : 'Unknown error';
			}
			return null;
		} finally {
			if (spaceId.value === currentSpaceId && spaceGeneration === requestGeneration && loadingCount.value > 0) {
				loadingCount.value--;
			}
		}
	};

	watch(spaceId, () => {
		spaceGeneration++;
		mediaStateData.value = null;
		error.value = null;
		loadingCount.value = 0;
	});

	return {
		mediaState,
		isLoading,
		error,
		fetchMediaState,
		hasMedia,
		anyOn,
		allOff,
	};
};
