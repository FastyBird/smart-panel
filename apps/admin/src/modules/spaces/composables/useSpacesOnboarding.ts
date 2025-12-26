import { computed, reactive } from 'vue';

import { injectBackendClient } from '../../../common';
import { SpacesModuleCreateSpaceCategory, SpacesModuleCreateSpaceType } from '../../../openapi';
import { SpaceCategory, SpaceType } from '../spaces.constants';
import { SpacesApiException } from '../spaces.exceptions';
import type { ISpace, ISpaceCreateData } from '../store';

interface ProposedSpace {
	name: string;
	deviceIds: string[];
	deviceCount: number;
	selected: boolean;
}

export interface DeviceInfo {
	id: string;
	name: string;
	spaceId: string | null;
}

export interface DisplayInfo {
	id: string;
	name: string | null;
	spaceId: string | null;
}

interface WizardState {
	currentStep: number;
	existingSpaces: ISpace[];
	spaces: ISpace[];
	proposedSpaces: ProposedSpace[];
	deviceAssignments: Record<string, string | null>; // deviceId -> spaceId
	displayAssignments: Record<string, string | null>; // displayId -> spaceId
	isLoading: boolean;
	error: string | null;
}

const apiTypeToSpaceType = (apiType: SpacesModuleCreateSpaceType): SpaceType => {
	switch (apiType) {
		case SpacesModuleCreateSpaceType.room:
			return SpaceType.ROOM;
		case SpacesModuleCreateSpaceType.zone:
			return SpaceType.ZONE;
		default:
			return SpaceType.ROOM;
	}
};

const spaceTypeToApiType = (spaceType: SpaceType | undefined): SpacesModuleCreateSpaceType => {
	switch (spaceType) {
		case SpaceType.ROOM:
			return SpacesModuleCreateSpaceType.room;
		case SpaceType.ZONE:
			return SpacesModuleCreateSpaceType.zone;
		default:
			return SpacesModuleCreateSpaceType.room;
	}
};

const apiCategoryToSpaceCategory = (apiCategory: SpacesModuleCreateSpaceCategory | null | undefined): SpaceCategory | null => {
	if (!apiCategory) return null;
	return apiCategory as unknown as SpaceCategory;
};

export const useSpacesOnboarding = () => {
	const backendClient = injectBackendClient();

	const state = reactive<WizardState>({
		currentStep: 0,
		existingSpaces: [],
		spaces: [],
		proposedSpaces: [],
		deviceAssignments: {},
		displayAssignments: {},
		isLoading: false,
		error: null,
	});

	const isLoading = computed(() => state.isLoading);
	const error = computed(() => state.error);
	const currentStep = computed(() => state.currentStep);
	const existingSpaces = computed(() => state.existingSpaces);
	const spaces = computed(() => state.spaces);
	const proposedSpaces = computed(() => state.proposedSpaces);
	const deviceAssignments = computed(() => state.deviceAssignments);
	const displayAssignments = computed(() => state.displayAssignments);

	const fetchProposedSpaces = async (): Promise<void> => {
		state.isLoading = true;
		state.error = null;

		try {
			const response = await backendClient.GET('/modules/spaces/spaces/propose');

			if (response.error || !response.data?.data) {
				throw new SpacesApiException('Failed to fetch proposed spaces');
			}

			state.proposedSpaces = response.data.data.map((p) => ({
				name: p.name ?? '',
				deviceIds: p.device_ids ?? [],
				deviceCount: p.device_count ?? 0,
				selected: true,
			}));
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Unknown error';
			throw err;
		} finally {
			state.isLoading = false;
		}
	};

	const createSpacesFromProposals = async (): Promise<ISpace[]> => {
		state.isLoading = true;
		state.error = null;

		const createdSpaces: ISpace[] = [];

		try {
			const selectedProposals = state.proposedSpaces.filter((p) => p.selected);

			for (const proposal of selectedProposals) {
				const response = await backendClient.POST('/modules/spaces/spaces', {
					body: {
						data: {
							name: proposal.name,
							type: SpacesModuleCreateSpaceType.room,
						},
					},
				});

				if (response.error || !response.data?.data) {
					throw new SpacesApiException(`Failed to create space: ${proposal.name}`);
				}

				const space: ISpace = {
					id: response.data.data.id,
					name: response.data.data.name,
					description: response.data.data.description ?? null,
					type: apiTypeToSpaceType(response.data.data.type),
					category: apiCategoryToSpaceCategory(response.data.data.category),
					icon: response.data.data.icon ?? null,
					displayOrder: response.data.data.display_order ?? 0,
					primaryThermostatId: response.data.data.primary_thermostat_id ?? null,
					primaryTemperatureSensorId: response.data.data.primary_temperature_sensor_id ?? null,
					suggestionsEnabled: response.data.data.suggestions_enabled ?? true,
					createdAt: new Date(response.data.data.created_at),
					updatedAt: response.data.data.updated_at ? new Date(response.data.data.updated_at) : null,
					draft: false,
				};

				// Update state incrementally after each successful creation
				// This ensures we don't lose track of spaces if a later creation fails
				state.spaces = [...state.spaces, space];
				createdSpaces.push(space);

				// Pre-populate device assignments based on proposal
				for (const deviceId of proposal.deviceIds) {
					state.deviceAssignments[deviceId] = space.id;
				}

				// Mark proposal as no longer selected to prevent duplicate creation on back/next
				proposal.selected = false;
			}

			return createdSpaces;
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Unknown error';
			throw err;
		} finally {
			state.isLoading = false;
		}
	};

	const createSpace = async (data: ISpaceCreateData): Promise<ISpace> => {
		state.isLoading = true;
		state.error = null;

		try {
			const response = await backendClient.POST('/modules/spaces/spaces', {
				body: {
					data: {
						name: data.name,
						description: data.description,
						type: spaceTypeToApiType(data.type),
						icon: data.icon,
						display_order: data.displayOrder,
					},
				},
			});

			if (response.error || !response.data?.data) {
				throw new SpacesApiException('Failed to create space');
			}

			const space: ISpace = {
				id: response.data.data.id,
				name: response.data.data.name,
				description: response.data.data.description ?? null,
				type: apiTypeToSpaceType(response.data.data.type),
				category: apiCategoryToSpaceCategory(response.data.data.category),
				icon: response.data.data.icon ?? null,
				displayOrder: response.data.data.display_order ?? 0,
				primaryThermostatId: response.data.data.primary_thermostat_id ?? null,
				primaryTemperatureSensorId: response.data.data.primary_temperature_sensor_id ?? null,
				suggestionsEnabled: response.data.data.suggestions_enabled ?? true,
				createdAt: new Date(response.data.data.created_at),
				updatedAt: response.data.data.updated_at ? new Date(response.data.data.updated_at) : null,
				draft: false,
			};

			state.spaces.push(space);

			return space;
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Unknown error';
			throw err;
		} finally {
			state.isLoading = false;
		}
	};

	const setDeviceAssignment = (deviceId: string, spaceId: string | null): void => {
		state.deviceAssignments[deviceId] = spaceId;
	};

	const setDisplayAssignment = (displayId: string, spaceId: string | null): void => {
		state.displayAssignments[displayId] = spaceId;
	};

	const applyAssignments = async (): Promise<{ devicesAssigned: number; displaysAssigned: number }> => {
		state.isLoading = true;
		state.error = null;

		let totalDevicesAssigned = 0;
		let totalDisplaysAssigned = 0;

		try {
			// Group assignments by space
			const spaceAssignments: Record<string, { deviceIds: string[]; displayIds: string[] }> = {};

			for (const [deviceId, spaceId] of Object.entries(state.deviceAssignments)) {
				if (spaceId) {
					if (!spaceAssignments[spaceId]) {
						spaceAssignments[spaceId] = { deviceIds: [], displayIds: [] };
					}
					spaceAssignments[spaceId].deviceIds.push(deviceId);
				}
			}

			for (const [displayId, spaceId] of Object.entries(state.displayAssignments)) {
				if (spaceId) {
					if (!spaceAssignments[spaceId]) {
						spaceAssignments[spaceId] = { deviceIds: [], displayIds: [] };
					}
					spaceAssignments[spaceId].displayIds.push(displayId);
				}
			}

			// Apply assignments for each space
			for (const [spaceId, assignments] of Object.entries(spaceAssignments)) {
				const response = await backendClient.POST('/modules/spaces/spaces/{id}/assign', {
					params: { path: { id: spaceId } },
					body: {
						data: {
							device_ids: assignments.deviceIds,
							display_ids: assignments.displayIds,
						},
					},
				});

				if (response.error) {
					throw new SpacesApiException(`Failed to assign items to space ${spaceId}`);
				}

				if (response.data?.data) {
					totalDevicesAssigned += response.data.data.devices_assigned ?? 0;
					totalDisplaysAssigned += response.data.data.displays_assigned ?? 0;
				}
			}

			return { devicesAssigned: totalDevicesAssigned, displaysAssigned: totalDisplaysAssigned };
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Unknown error';
			throw err;
		} finally {
			state.isLoading = false;
		}
	};

	const setStep = (step: number): void => {
		state.currentStep = step;
	};

	const nextStep = (): void => {
		state.currentStep++;
	};

	const prevStep = (): void => {
		if (state.currentStep > 0) {
			state.currentStep--;
		}
	};

	const toggleProposedSpace = (index: number): void => {
		if (state.proposedSpaces[index]) {
			state.proposedSpaces[index].selected = !state.proposedSpaces[index].selected;
		}
	};

	const addManualSpace = (name: string): void => {
		state.proposedSpaces.push({
			name,
			deviceIds: [],
			deviceCount: 0,
			selected: true,
		});
	};

	const removeProposedSpace = (index: number): void => {
		state.proposedSpaces.splice(index, 1);
	};

	const initializeFromExistingSpaces = (existingSpacesData: ISpace[]): void => {
		state.existingSpaces = [...existingSpacesData];
	};

	const initializeDeviceAssignments = (devices: DeviceInfo[]): void => {
		for (const device of devices) {
			state.deviceAssignments[device.id] = device.spaceId ?? null;
		}
	};

	const initializeDisplayAssignments = (displays: DisplayInfo[]): void => {
		for (const display of displays) {
			state.displayAssignments[display.id] = display.spaceId ?? null;
		}
	};

	const fetchDevices = async (): Promise<DeviceInfo[]> => {
		state.isLoading = true;
		state.error = null;

		try {
			const response = await backendClient.GET('/modules/devices/devices');

			if (response.error || !response.data?.data) {
				throw new SpacesApiException('Failed to fetch devices');
			}

			return response.data.data.map((d) => ({
				id: d.id,
				name: d.name,
				spaceId: d.space_id ?? null,
			}));
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Unknown error';
			throw err;
		} finally {
			state.isLoading = false;
		}
	};

	const fetchDisplays = async (): Promise<DisplayInfo[]> => {
		state.isLoading = true;
		state.error = null;

		try {
			const response = await backendClient.GET('/modules/displays/displays');

			if (response.error || !response.data?.data) {
				throw new SpacesApiException('Failed to fetch displays');
			}

			return response.data.data.map((d) => ({
				id: d.id,
				name: d.name ?? null,
				spaceId: d.space_id ?? null,
			}));
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Unknown error';
			throw err;
		} finally {
			state.isLoading = false;
		}
	};

	const fetchExistingSpaces = async (): Promise<ISpace[]> => {
		state.isLoading = true;
		state.error = null;

		try {
			const response = await backendClient.GET('/modules/spaces/spaces');

			if (response.error || !response.data?.data) {
				throw new SpacesApiException('Failed to fetch spaces');
			}

			const spaces: ISpace[] = response.data.data.map((s) => ({
				id: s.id,
				name: s.name,
				description: s.description ?? null,
				type: apiTypeToSpaceType(s.type),
				category: apiCategoryToSpaceCategory(s.category),
				icon: s.icon ?? null,
				displayOrder: s.display_order ?? 0,
				primaryThermostatId: s.primary_thermostat_id ?? null,
				primaryTemperatureSensorId: s.primary_temperature_sensor_id ?? null,
				suggestionsEnabled: s.suggestions_enabled ?? true,
				createdAt: new Date(s.created_at),
				updatedAt: s.updated_at ? new Date(s.updated_at) : null,
				draft: false,
			}));

			state.existingSpaces = spaces;

			return spaces;
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Unknown error';
			throw err;
		} finally {
			state.isLoading = false;
		}
	};

	const getSummary = () => {
		const spaceCount = state.existingSpaces.length + state.spaces.length;
		const assignedDevices = Object.values(state.deviceAssignments).filter((v) => v !== null).length;
		const assignedDisplays = Object.values(state.displayAssignments).filter((v) => v !== null).length;
		const unassignedDevices = Object.values(state.deviceAssignments).filter((v) => v === null).length;
		const unassignedDisplays = Object.values(state.displayAssignments).filter((v) => v === null).length;

		const devicesBySpace: Record<string, number> = {};
		const displaysBySpace: Record<string, number> = {};

		for (const spaceId of Object.values(state.deviceAssignments)) {
			if (spaceId) {
				devicesBySpace[spaceId] = (devicesBySpace[spaceId] ?? 0) + 1;
			}
		}

		for (const spaceId of Object.values(state.displayAssignments)) {
			if (spaceId) {
				displaysBySpace[spaceId] = (displaysBySpace[spaceId] ?? 0) + 1;
			}
		}

		return {
			spaceCount,
			assignedDevices,
			assignedDisplays,
			unassignedDevices,
			unassignedDisplays,
			devicesBySpace,
			displaysBySpace,
		};
	};

	return {
		// State
		isLoading,
		error,
		currentStep,
		existingSpaces,
		spaces,
		proposedSpaces,
		deviceAssignments,
		displayAssignments,
		// Actions
		fetchProposedSpaces,
		fetchDevices,
		fetchDisplays,
		fetchExistingSpaces,
		createSpacesFromProposals,
		createSpace,
		setDeviceAssignment,
		setDisplayAssignment,
		applyAssignments,
		setStep,
		nextStep,
		prevStep,
		toggleProposedSpace,
		addManualSpace,
		removeProposedSpace,
		initializeFromExistingSpaces,
		initializeDeviceAssignments,
		initializeDisplayAssignments,
		getSummary,
	};
};
