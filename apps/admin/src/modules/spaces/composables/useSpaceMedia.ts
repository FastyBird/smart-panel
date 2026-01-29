import { computed, ref, type ComputedRef, type Ref } from 'vue';

import {
	type PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyActivatePostParametersPathActivityKey,
	type SpacesModuleCreateMediaEndpointType,
} from '../../../openapi';
import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';

export { SpacesModuleCreateMediaEndpointType as MediaEndpointType } from '../../../openapi';
export { PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyActivatePostParametersPathActivityKey as MediaActivityKey } from '../../../openapi';

export interface IDerivedMediaCapabilities {
	power: boolean;
	volume: boolean;
	mute: boolean;
	playback: boolean;
	track: boolean;
	inputSelect: boolean;
	remoteCommands: boolean;
}

export interface IDerivedMediaEndpoint {
	endpointId: string;
	spaceId: string;
	deviceId: string;
	type: SpacesModuleCreateMediaEndpointType;
	name: string;
	capabilities: IDerivedMediaCapabilities;
}

export interface IMediaActivityBinding {
	id: string;
	spaceId: string;
	activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyActivatePostParametersPathActivityKey;
	displayEndpointId: string | null;
	audioEndpointId: string | null;
	sourceEndpointId: string | null;
	remoteEndpointId: string | null;
	displayInputId: string | null;
	audioVolumePreset: number | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface IBindingSavePayload {
	displayEndpointId?: string | null;
	audioEndpointId?: string | null;
	sourceEndpointId?: string | null;
	remoteEndpointId?: string | null;
	displayInputId?: string | null;
	audioVolumePreset?: number | null;
}

export interface IUseSpaceMedia {
	endpoints: ComputedRef<IDerivedMediaEndpoint[]>;
	bindings: ComputedRef<IMediaActivityBinding[]>;
	fetchingEndpoints: Ref<boolean>;
	fetchingBindings: Ref<boolean>;
	savingBinding: Ref<boolean>;
	applyingDefaults: Ref<boolean>;
	endpointsError: Ref<string | null>;
	bindingsError: Ref<string | null>;
	saveError: Ref<string | null>;
	fetchEndpoints: () => Promise<void>;
	fetchBindings: () => Promise<void>;
	saveBinding: (bindingId: string, payload: IBindingSavePayload) => Promise<IMediaActivityBinding>;
	createBinding: (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyActivatePostParametersPathActivityKey,
		payload: IBindingSavePayload,
	) => Promise<IMediaActivityBinding>;
	applyDefaults: () => Promise<void>;
	endpointsByType: (
		type: SpacesModuleCreateMediaEndpointType,
	) => ComputedRef<IDerivedMediaEndpoint[]>;
	findBindingByActivity: (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyActivatePostParametersPathActivityKey,
	) => IMediaActivityBinding | undefined;
}

const transformEndpoint = (raw: Record<string, unknown>): IDerivedMediaEndpoint => {
	const caps = (raw.capabilities as Record<string, boolean> | null | undefined) ?? {};

	return {
		endpointId: raw.endpoint_id as string,
		spaceId: raw.space_id as string,
		deviceId: raw.device_id as string,
		type: raw.type as SpacesModuleCreateMediaEndpointType,
		name: raw.name as string,
		capabilities: {
			power: caps.power ?? false,
			volume: caps.volume ?? false,
			mute: caps.mute ?? false,
			playback: caps.playback ?? false,
			track: caps.track ?? false,
			inputSelect: caps.input_select ?? false,
			remoteCommands: caps.remote_commands ?? false,
		},
	};
};

const transformBinding = (raw: Record<string, unknown>): IMediaActivityBinding => {
	return {
		id: raw.id as string,
		spaceId: raw.space_id as string,
		activityKey:
			raw.activity_key as PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyActivatePostParametersPathActivityKey,
		displayEndpointId: (raw.display_endpoint_id as string) ?? null,
		audioEndpointId: (raw.audio_endpoint_id as string) ?? null,
		sourceEndpointId: (raw.source_endpoint_id as string) ?? null,
		remoteEndpointId: (raw.remote_endpoint_id as string) ?? null,
		displayInputId: (raw.display_input_id as string) ?? null,
		audioVolumePreset: (raw.audio_volume_preset as number) ?? null,
		createdAt: raw.created_at as string,
		updatedAt: (raw.updated_at as string) ?? null,
	};
};

export const useSpaceMedia = (spaceId: Ref<string | undefined>): IUseSpaceMedia => {
	const backend = useBackend();

	const endpointsData = ref<IDerivedMediaEndpoint[]>([]);
	const bindingsData = ref<IMediaActivityBinding[]>([]);
	const fetchingEndpoints = ref<boolean>(false);
	const fetchingBindings = ref<boolean>(false);
	const savingBinding = ref<boolean>(false);
	const applyingDefaults = ref<boolean>(false);
	const endpointsError = ref<string | null>(null);
	const bindingsError = ref<string | null>(null);
	const saveError = ref<string | null>(null);

	const endpoints = computed<IDerivedMediaEndpoint[]>(() => endpointsData.value);
	const bindings = computed<IMediaActivityBinding[]>(() => bindingsData.value);

	const fetchEndpoints = async (): Promise<void> => {
		if (!spaceId.value || fetchingEndpoints.value) return;

		fetchingEndpoints.value = true;
		endpointsError.value = null;

		try {
			const { data: responseData, error } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/endpoints`,
				{ params: { path: { id: spaceId.value } } },
			);

			if (error || !responseData) {
				throw new Error('Failed to fetch media endpoints');
			}

			const result = (responseData.data ?? {}) as Record<string, unknown>;
			const rawEndpoints = (result.endpoints ?? []) as Record<string, unknown>[];
			endpointsData.value = rawEndpoints.map(transformEndpoint);
		} catch (e: unknown) {
			endpointsError.value = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			fetchingEndpoints.value = false;
		}
	};

	const fetchBindings = async (): Promise<void> => {
		if (!spaceId.value || fetchingBindings.value) return;

		fetchingBindings.value = true;
		bindingsError.value = null;

		try {
			const { data: responseData, error } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/bindings`,
				{ params: { path: { id: spaceId.value } } },
			);

			if (error || !responseData) {
				throw new Error('Failed to fetch media bindings');
			}

			const rawBindings = (responseData.data ?? []) as unknown as Record<string, unknown>[];
			bindingsData.value = rawBindings.map(transformBinding);
		} catch (e: unknown) {
			bindingsError.value = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			fetchingBindings.value = false;
		}
	};

	const saveBinding = async (bindingId: string, payload: IBindingSavePayload): Promise<IMediaActivityBinding> => {
		if (!spaceId.value) throw new Error('Space ID is required');

		savingBinding.value = true;
		saveError.value = null;

		try {
			const { data: responseData, error } = await backend.client.PATCH(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/bindings/{bindingId}`,
				{
					params: { path: { id: spaceId.value, bindingId } },
					body: {
						data: {
							display_endpoint_id: payload.displayEndpointId,
							audio_endpoint_id: payload.audioEndpointId,
							source_endpoint_id: payload.sourceEndpointId,
							remote_endpoint_id: payload.remoteEndpointId,
							display_input_id: payload.displayInputId,
							audio_volume_preset: payload.audioVolumePreset,
						} as Record<string, string | number | null | undefined>,
					},
				},
			);

			if (error || !responseData || !responseData.data) {
				const errBody = error as Record<string, unknown> | undefined;
				const message = (errBody?.message as string) ?? 'Failed to save binding';
				throw new Error(message);
			}

			const updated = transformBinding(responseData.data as unknown as Record<string, unknown>);

			// Update local state
			const idx = bindingsData.value.findIndex((b) => b.id === updated.id);
			if (idx >= 0) {
				bindingsData.value[idx] = updated;
			}

			return updated;
		} catch (e: unknown) {
			saveError.value = e instanceof Error ? e.message : 'Unknown error';
			throw e;
		} finally {
			savingBinding.value = false;
		}
	};

	const createBinding = async (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyActivatePostParametersPathActivityKey,
		payload: IBindingSavePayload,
	): Promise<IMediaActivityBinding> => {
		if (!spaceId.value) throw new Error('Space ID is required');

		savingBinding.value = true;
		saveError.value = null;

		try {
			const { data: responseData, error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/bindings`,
				{
					params: { path: { id: spaceId.value } },
					body: {
						data: {
							activity_key: activityKey,
							display_endpoint_id: payload.displayEndpointId ?? undefined,
							audio_endpoint_id: payload.audioEndpointId ?? undefined,
							source_endpoint_id: payload.sourceEndpointId ?? undefined,
							remote_endpoint_id: payload.remoteEndpointId ?? undefined,
							display_input_id: payload.displayInputId ?? undefined,
							audio_volume_preset: payload.audioVolumePreset ?? undefined,
						},
					},
				},
			);

			if (error || !responseData || !responseData.data) {
				const errBody = error as Record<string, unknown> | undefined;
				const message = (errBody?.message as string) ?? 'Failed to create binding';
				throw new Error(message);
			}

			const created = transformBinding(responseData.data as unknown as Record<string, unknown>);
			bindingsData.value.push(created);

			return created;
		} catch (e: unknown) {
			saveError.value = e instanceof Error ? e.message : 'Unknown error';
			throw e;
		} finally {
			savingBinding.value = false;
		}
	};

	const applyDefaults = async (): Promise<void> => {
		if (!spaceId.value) return;

		applyingDefaults.value = true;

		try {
			const { data: responseData, error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/bindings/apply-defaults`,
				{ params: { path: { id: spaceId.value } } },
			);

			if (error || !responseData) {
				throw new Error('Failed to apply defaults');
			}

			const rawBindings = (responseData.data ?? []) as unknown as Record<string, unknown>[];
			bindingsData.value = rawBindings.map(transformBinding);
		} catch (e: unknown) {
			bindingsError.value = e instanceof Error ? e.message : 'Unknown error';
			throw e;
		} finally {
			applyingDefaults.value = false;
		}
	};

	const endpointsByType = (
		type: SpacesModuleCreateMediaEndpointType,
	): ComputedRef<IDerivedMediaEndpoint[]> => {
		return computed(() => endpointsData.value.filter((ep) => ep.type === type));
	};

	const findBindingByActivity = (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyActivatePostParametersPathActivityKey,
	): IMediaActivityBinding | undefined => {
		return bindingsData.value.find((b) => b.activityKey === activityKey);
	};

	return {
		endpoints,
		bindings,
		fetchingEndpoints,
		fetchingBindings,
		savingBinding,
		applyingDefaults,
		endpointsError,
		bindingsError,
		saveError,
		fetchEndpoints,
		fetchBindings,
		saveBinding,
		createBinding,
		applyDefaults,
		endpointsByType,
		findBindingByActivity,
	};
};
