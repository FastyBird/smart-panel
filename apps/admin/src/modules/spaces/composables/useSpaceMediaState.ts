import { ref, computed, type ComputedRef, type Ref } from 'vue';

import type { ISpace } from '../store';

// Note: Media domain now uses routing-based architecture (V2)
// Old media state API has been removed from the backend
// This composable is stubbed out until the new V2 media routing API is available

/**
 * Aggregated state for media devices assigned to a role.
 * @deprecated Media domain now uses routing-based architecture (V2)
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
 * @deprecated Media domain now uses routing-based architecture (V2)
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
 * @deprecated Media domain now uses routing-based architecture (V2)
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

/**
 * Composable for fetching and managing media state for a space.
 *
 * @deprecated Media domain now uses routing-based architecture (V2).
 * This composable is stubbed out and always returns null/empty values.
 * It will be updated when the new V2 media routing API is available.
 *
 * @param _spaceId - Reactive reference to the space ID (unused in stub)
 * @returns Stubbed media state with null/empty values
 */
export const useSpaceMediaState = (_spaceId: Ref<ISpace['id'] | undefined>): IUseSpaceMediaState => {
	const mediaStateData = ref<IMediaState | null>(null);
	const isLoading = computed(() => false);
	const error = ref<string | null>(null);

	const mediaState = computed(() => mediaStateData.value);
	const hasMedia = computed(() => false);
	const anyOn = computed(() => false);
	const allOff = computed(() => true);

	const fetchMediaState = async (): Promise<IMediaState | null> => {
		// Stub - media state API no longer exists
		// Will be updated when V2 media routing API is available
		return null;
	};

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
