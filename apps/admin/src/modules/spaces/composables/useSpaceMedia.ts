import { computed, ref, type ComputedRef, type Ref } from 'vue';

import {
	type PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
	type SpacesModuleDataMediaCapabilitySummarySuggested_endpoint_types,
} from '../../../openapi';
import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { SPACES_MODULE_PREFIX } from '../spaces.constants';

export { SpacesModuleDataMediaCapabilitySummarySuggested_endpoint_types as MediaEndpointType } from '../../../openapi';
export { PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey as MediaActivityKey } from '../../../openapi';

export interface IDerivedMediaCapabilities {
	power: boolean;
	volume: boolean;
	mute: boolean;
	playback: boolean;
	track: boolean;
	inputSelect: boolean;
	remoteCommands: boolean;
}

export interface IDerivedMediaPropertyLink {
	propertyId: string;
	dataType?: string;
	format?: (string | number)[] | null;
}

export interface IDerivedMediaLinks {
	inputSelect?: IDerivedMediaPropertyLink;
	[key: string]: IDerivedMediaPropertyLink | { commands: Record<string, string> } | undefined;
}

export interface IDerivedMediaEndpoint {
	endpointId: string;
	spaceId: string;
	deviceId: string;
	type: SpacesModuleDataMediaCapabilitySummarySuggested_endpoint_types;
	name: string;
	capabilities: IDerivedMediaCapabilities;
	links?: IDerivedMediaLinks;
}

export interface IMediaActivityBinding {
	id: string;
	spaceId: string;
	activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey;
	displayEndpointId: string | null;
	audioEndpointId: string | null;
	sourceEndpointId: string | null;
	remoteEndpointId: string | null;
	displayInputId: string | null;
	audioInputId: string | null;
	sourceInputId: string | null;
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
	audioInputId?: string | null;
	sourceInputId?: string | null;
	audioVolumePreset?: number | null;
}

export interface IMediaStepFailure {
	stepIndex: number;
	critical: boolean;
	reason: string;
	targetDeviceId?: string;
	kind?: string;
	propertyId?: string;
	commandId?: string;
	label?: string;
	timestamp?: string;
}

export interface IMediaActivationSummary {
	stepsTotal: number;
	stepsSucceeded: number;
	stepsFailed: number;
	failures?: IMediaStepFailure[];
	warnings?: IMediaStepFailure[];
	errors?: IMediaStepFailure[];
	warningCount?: number;
	errorCount?: number;
}

export interface IMediaResolvedDevices {
	displayDeviceId?: string;
	audioDeviceId?: string;
	sourceDeviceId?: string;
	remoteDeviceId?: string;
}

export type MediaActivationState = 'activating' | 'active' | 'failed' | 'deactivated';

export interface IMediaActiveState {
	activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey | null;
	state: MediaActivationState;
	resolved?: IMediaResolvedDevices;
	summary?: IMediaActivationSummary;
	warnings?: string[];
	activatedAt?: string | null;
	updatedAt?: string | null;
}

export interface IMediaExecutionStep {
	targetDeviceId: string;
	action: {
		kind: string;
		propertyId?: string;
		value?: unknown;
	};
	critical: boolean;
	label?: string;
}

export interface IMediaDryRunWarning {
	label: string;
}

export interface IMediaDryRunPreview {
	spaceId: string;
	activityKey: string;
	resolved: IMediaResolvedDevices;
	plan: IMediaExecutionStep[];
	warnings: IMediaDryRunWarning[];
}

export interface IUseSpaceMedia {
	endpoints: ComputedRef<IDerivedMediaEndpoint[]>;
	bindings: ComputedRef<IMediaActivityBinding[]>;
	activeState: Ref<IMediaActiveState | null>;
	fetchingEndpoints: Ref<boolean>;
	fetchingBindings: Ref<boolean>;
	fetchingActiveState: Ref<boolean>;
	activating: Ref<boolean>;
	deactivating: Ref<boolean>;
	savingBinding: Ref<boolean>;
	applyingDefaults: Ref<boolean>;
	endpointsError: Ref<string | null>;
	bindingsError: Ref<string | null>;
	saveError: Ref<string | null>;
	activationError: Ref<string | null>;
	activationErrorSource: Ref<'activate' | 'deactivate' | 'fetch' | null>;
	fetchEndpoints: () => Promise<void>;
	fetchBindings: () => Promise<void>;
	fetchActiveState: () => Promise<void>;
	previewing: Ref<boolean>;
	activate: (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
	) => Promise<IMediaActiveState>;
	preview: (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
	) => Promise<IMediaDryRunPreview>;
	deactivate: () => Promise<IMediaActiveState>;
	saveBinding: (bindingId: string, payload: IBindingSavePayload) => Promise<IMediaActivityBinding>;
	createBinding: (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
		payload: IBindingSavePayload,
	) => Promise<IMediaActivityBinding>;
	applyDefaults: () => Promise<void>;
	endpointsByType: (
		type: SpacesModuleDataMediaCapabilitySummarySuggested_endpoint_types,
	) => ComputedRef<IDerivedMediaEndpoint[]>;
	findBindingByActivity: (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
	) => IMediaActivityBinding | undefined;
}

const transformPropertyLink = (raw: Record<string, unknown>): IDerivedMediaPropertyLink => ({
	propertyId: (raw.property_id as string) ?? (raw.propertyId as string),
	dataType: (raw.data_type as string | undefined) ?? (raw.dataType as string | undefined),
	format: (raw.format as (string | number)[] | null | undefined) ?? null,
});

const transformEndpoint = (raw: Record<string, unknown>): IDerivedMediaEndpoint => {
	const caps = (raw.capabilities as Record<string, boolean> | null | undefined) ?? {};
	const rawLinks = (raw.links as Record<string, unknown> | null | undefined) ?? {};

	const links: IDerivedMediaLinks = {};

	if (rawLinks.input_select || rawLinks.inputSelect) {
		links.inputSelect = transformPropertyLink(
			(rawLinks.input_select ?? rawLinks.inputSelect) as Record<string, unknown>,
		);
	}

	return {
		endpointId: raw.endpoint_id as string,
		spaceId: raw.space_id as string,
		deviceId: raw.device_id as string,
		type: raw.type as SpacesModuleDataMediaCapabilitySummarySuggested_endpoint_types,
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
		links,
	};
};

const transformBinding = (raw: Record<string, unknown>): IMediaActivityBinding => {
	return {
		id: raw.id as string,
		spaceId: raw.space_id as string,
		activityKey:
			raw.activity_key as PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
		displayEndpointId: (raw.display_endpoint_id as string) ?? null,
		audioEndpointId: (raw.audio_endpoint_id as string) ?? null,
		sourceEndpointId: (raw.source_endpoint_id as string) ?? null,
		remoteEndpointId: (raw.remote_endpoint_id as string) ?? null,
		displayInputId: (raw.display_input_id as string) ?? null,
		audioInputId: (raw.audio_input_id as string) ?? null,
		sourceInputId: (raw.source_input_id as string) ?? null,
		audioVolumePreset: (raw.audio_volume_preset as number) ?? null,
		createdAt: raw.created_at as string,
		updatedAt: (raw.updated_at as string) ?? null,
	};
};

const transformStepFailure = (raw: Record<string, unknown>): IMediaStepFailure => ({
	stepIndex: (raw.step_index as number) ?? (raw.stepIndex as number) ?? 0,
	critical: (raw.critical as boolean) ?? false,
	reason: (raw.reason as string) ?? '',
	targetDeviceId: (raw.target_device_id as string | undefined) ?? (raw.targetDeviceId as string | undefined),
	kind: (raw.kind as string | undefined),
	propertyId: (raw.property_id as string | undefined) ?? (raw.propertyId as string | undefined),
	commandId: (raw.command_id as string | undefined) ?? (raw.commandId as string | undefined),
	label: (raw.label as string | undefined),
	timestamp: (raw.timestamp as string | undefined),
});

const transformResolvedDevices = (data: Record<string, unknown>): IMediaResolvedDevices => ({
	displayDeviceId: (data.display_device_id as string | undefined) ?? (data.displayDeviceId as string | undefined),
	audioDeviceId: (data.audio_device_id as string | undefined) ?? (data.audioDeviceId as string | undefined),
	sourceDeviceId: (data.source_device_id as string | undefined) ?? (data.sourceDeviceId as string | undefined),
	remoteDeviceId: (data.remote_device_id as string | undefined) ?? (data.remoteDeviceId as string | undefined),
});

const transformSummary = (data: Record<string, unknown>): IMediaActivationSummary => ({
	stepsTotal: (data.steps_total as number) ?? (data.stepsTotal as number) ?? 0,
	stepsSucceeded: (data.steps_succeeded as number) ?? (data.stepsSucceeded as number) ?? 0,
	stepsFailed: (data.steps_failed as number) ?? (data.stepsFailed as number) ?? 0,
	failures: Array.isArray(data.failures)
		? (data.failures as Record<string, unknown>[]).map(transformStepFailure)
		: undefined,
	warnings: Array.isArray(data.warnings)
		? (data.warnings as Record<string, unknown>[]).map(transformStepFailure)
		: undefined,
	errors: Array.isArray(data.errors)
		? (data.errors as Record<string, unknown>[]).map(transformStepFailure)
		: undefined,
	warningCount: (data.warning_count as number) ?? (data.warningCount as number) ?? 0,
	errorCount: (data.error_count as number) ?? (data.errorCount as number) ?? 0,
});

const transformExecutionStep = (raw: Record<string, unknown>): IMediaExecutionStep => {
	const action = (raw.action as Record<string, unknown>) ?? {};

	return {
		targetDeviceId:
			(raw.target_device_id as string) ?? (raw.targetDeviceId as string) ?? '',
		action: {
			kind: (action.kind as string) ?? 'unknown',
			propertyId: (action.property_id as string | undefined) ?? (action.propertyId as string | undefined),
			value: action.value,
		},
		critical: (raw.critical as boolean) ?? false,
		label: (raw.label as string | undefined),
	};
};

const transformDryRunPreview = (raw: Record<string, unknown>): IMediaDryRunPreview => {
	const resolved = raw.resolved as Record<string, unknown> | undefined;
	const plan = (raw.plan as Record<string, unknown>[]) ?? [];
	const warnings = (raw.warnings as Record<string, unknown>[]) ?? [];

	return {
		spaceId: (raw.space_id as string) ?? (raw.spaceId as string) ?? '',
		activityKey: (raw.activity_key as string) ?? (raw.activityKey as string) ?? '',
		resolved: resolved ? transformResolvedDevices(resolved) : {},
		plan: plan.map(transformExecutionStep),
		warnings: warnings.map((w) => ({
			label: (w.label as string) ?? '',
		})),
	};
};

const transformActivationResult = (raw: Record<string, unknown>): IMediaActiveState => {
	const resolved = raw.resolved as Record<string, unknown> | undefined;
	const summary = raw.summary as Record<string, unknown> | undefined;

	return {
		activityKey:
			(raw.activity_key as PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey) ??
			null,
		state: (raw.state as MediaActivationState) ?? 'deactivated',
		resolved: resolved ? transformResolvedDevices(resolved) : undefined,
		summary: summary ? transformSummary(summary) : undefined,
		warnings: raw.warnings as string[] | undefined,
	};
};

const transformActiveEntity = (raw: Record<string, unknown>): IMediaActiveState => {
	let resolved: IMediaResolvedDevices | undefined;
	let summary: IMediaActivationSummary | undefined;

	if (raw.resolved) {
		try {
			const parsed = typeof raw.resolved === 'string' ? JSON.parse(raw.resolved) : raw.resolved;
			resolved = transformResolvedDevices(parsed as Record<string, unknown>);
		} catch {
			// ignore parse errors
		}
	}

	if (raw.last_result) {
		try {
			const parsed = typeof raw.last_result === 'string' ? JSON.parse(raw.last_result) : raw.last_result;
			summary = transformSummary(parsed as Record<string, unknown>);
		} catch {
			// ignore parse errors
		}
	}

	return {
		activityKey:
			(raw.activity_key as PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey) ??
			null,
		state: (raw.state as MediaActivationState) ?? 'deactivated',
		resolved,
		summary,
		warnings: raw.warnings as string[] | undefined,
		activatedAt: (raw.activated_at as string) ?? null,
		updatedAt: (raw.updated_at as string) ?? null,
	};
};

export const useSpaceMedia = (spaceId: Ref<string | undefined>): IUseSpaceMedia => {
	const backend = useBackend();

	const endpointsData = ref<IDerivedMediaEndpoint[]>([]);
	const bindingsData = ref<IMediaActivityBinding[]>([]);
	const activeState = ref<IMediaActiveState | null>(null);
	const fetchingEndpoints = ref<boolean>(false);
	const fetchingBindings = ref<boolean>(false);
	const fetchingActiveState = ref<boolean>(false);
	const activating = ref<boolean>(false);
	const deactivating = ref<boolean>(false);
	const savingBinding = ref<boolean>(false);
	const applyingDefaults = ref<boolean>(false);
	const endpointsError = ref<string | null>(null);
	const bindingsError = ref<string | null>(null);
	const saveError = ref<string | null>(null);
	const previewing = ref<boolean>(false);
	const activationError = ref<string | null>(null);
	const activationErrorSource = ref<'activate' | 'deactivate' | 'fetch' | null>(null);

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
							audio_input_id: payload.audioInputId,
							source_input_id: payload.sourceInputId,
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
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
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
							audio_input_id: payload.audioInputId ?? undefined,
							source_input_id: payload.sourceInputId ?? undefined,
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

	const fetchActiveState = async (): Promise<void> => {
		if (!spaceId.value || fetchingActiveState.value) return;

		fetchingActiveState.value = true;
		activationError.value = null;
		activationErrorSource.value = null;

		try {
			const { data: responseData, error } = await backend.client.GET(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/activities/active`,
				{ params: { path: { id: spaceId.value } } },
			);

			if (error || !responseData) {
				throw new Error('Failed to fetch active state');
			}

			const raw = responseData.data as Record<string, unknown> | null;
			activeState.value = raw ? transformActiveEntity(raw) : null;
		} catch (e: unknown) {
			activationError.value = e instanceof Error ? e.message : 'Unknown error';
			activationErrorSource.value = 'fetch';
		} finally {
			fetchingActiveState.value = false;
		}
	};

	const pollActiveState = async (attempts: number = 3, delayMs: number = 1000): Promise<void> => {
		for (let i = 0; i < attempts; i++) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
			await fetchActiveState();
			if (activeState.value?.state === 'active' || activeState.value?.state === 'failed' || activeState.value?.state === 'deactivated') {
				break;
			}
		}
	};

	const preview = async (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
	): Promise<IMediaDryRunPreview> => {
		if (!spaceId.value) throw new Error('Space ID is required');

		previewing.value = true;

		try {
			const { data: responseData, error } = await backend.client.POST(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/activities/{activityKey}/preview` as any,
				{
					params: {
						path: { id: spaceId.value, activityKey },
					},
				},
			);

			if (error || !responseData || !responseData.data) {
				const errBody = error as Record<string, unknown> | undefined;
				const message = (errBody?.message as string) ?? 'Failed to preview activity';
				throw new Error(message);
			}

			return transformDryRunPreview(responseData.data as unknown as Record<string, unknown>);
		} finally {
			previewing.value = false;
		}
	};

	const activate = async (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
	): Promise<IMediaActiveState> => {
		if (!spaceId.value) throw new Error('Space ID is required');

		activating.value = true;
		activationError.value = null;
		activationErrorSource.value = null;

		// Optimistic UI
		activeState.value = {
			activityKey,
			state: 'activating',
		};

		try {
			const { data: responseData, error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/activities/{activityKey}/activate`,
				{
					params: { path: { id: spaceId.value, activityKey } },
				},
			);

			if (error || !responseData || !responseData.data) {
				const errBody = error as Record<string, unknown> | undefined;
				const message = (errBody?.message as string) ?? 'Failed to activate activity';
				throw new Error(message);
			}

			const result = transformActivationResult(responseData.data as unknown as Record<string, unknown>);
			activeState.value = result;

			// Poll for stable state if still activating
			if (result.state === 'activating') {
				await pollActiveState();
			}

			return activeState.value ?? result;
		} catch (e: unknown) {
			activationError.value = e instanceof Error ? e.message : 'Unknown error';
			activationErrorSource.value = 'activate';
			activeState.value = {
				activityKey,
				state: 'failed',
			};
			throw e;
		} finally {
			activating.value = false;
		}
	};

	const deactivate = async (): Promise<IMediaActiveState> => {
		if (!spaceId.value) throw new Error('Space ID is required');

		deactivating.value = true;
		activationError.value = null;
		activationErrorSource.value = null;

		try {
			const { data: responseData, error } = await backend.client.POST(
				`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}/media/activities/deactivate`,
				{
					params: { path: { id: spaceId.value } },
				},
			);

			if (error || !responseData || !responseData.data) {
				const errBody = error as Record<string, unknown> | undefined;
				const message = (errBody?.message as string) ?? 'Failed to deactivate';
				throw new Error(message);
			}

			const result = transformActivationResult(responseData.data as unknown as Record<string, unknown>);
			activeState.value = result;

			return result;
		} catch (e: unknown) {
			activationError.value = e instanceof Error ? e.message : 'Unknown error';
			activationErrorSource.value = 'deactivate';
			throw e;
		} finally {
			deactivating.value = false;
		}
	};

	const endpointsByType = (
		type: SpacesModuleDataMediaCapabilitySummarySuggested_endpoint_types,
	): ComputedRef<IDerivedMediaEndpoint[]> => {
		return computed(() => endpointsData.value.filter((ep) => ep.type === type));
	};

	const findBindingByActivity = (
		activityKey: PathsModulesSpacesSpacesIdMediaActivitiesActivityKeyPreviewPostParametersPathActivityKey,
	): IMediaActivityBinding | undefined => {
		return bindingsData.value.find((b) => b.activityKey === activityKey);
	};

	return {
		endpoints,
		bindings,
		activeState,
		fetchingEndpoints,
		fetchingBindings,
		fetchingActiveState,
		activating,
		deactivating,
		previewing,

		savingBinding,
		applyingDefaults,
		endpointsError,
		bindingsError,
		saveError,
		activationError,
		activationErrorSource,
		fetchEndpoints,
		fetchBindings,
		fetchActiveState,
		activate,
		preview,
		deactivate,
		saveBinding,
		createBinding,
		applyDefaults,
		endpointsByType,
		findBindingByActivity,
	};
};
