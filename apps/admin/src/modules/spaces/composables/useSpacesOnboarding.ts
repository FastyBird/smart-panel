import { computed, reactive } from 'vue';

import { injectBackendClient, useUuid } from '../../../common';
import {
	SpacesModuleCreateSpaceCategory,
	SpacesModuleCreateSpaceType,
	SpacesModuleDataSpaceCategory,
} from '../../../openapi';
import { SpaceCategory, SpaceType } from '../spaces.constants';
import { SpacesApiException } from '../spaces.exceptions';
import type { ISpace, ISpaceCreateData } from '../store';

interface ProposedSpace {
	name: string;
	deviceIds: string[];
	deviceCount: number;
	selected: boolean;
	type: SpaceType;
	category: SpaceCategory | null;
}

interface CustomSpace {
	name: string;
	selected: boolean;
	type: SpaceType;
	category: SpaceCategory | null;
}

export interface DeviceInfo {
	id: string;
	name: string;
	description: string | null;
	spaceId: string | null;
}

export interface DisplayInfo {
	id: string;
	name: string | null;
	macAddress: string;
	role: string;
	spaceId: string | null;
}

interface WizardState {
	currentStep: number;
	existingSpaces: ISpace[];
	spaces: ISpace[];
	proposedSpaces: ProposedSpace[];
	customSpaces: CustomSpace[];
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

const apiCategoryToSpaceCategory = (
	apiCategory: SpacesModuleCreateSpaceCategory | SpacesModuleDataSpaceCategory | null | undefined
): SpaceCategory | null => {
	if (!apiCategory) return null;
	return apiCategory as unknown as SpaceCategory;
};

const spaceCategoryToApiCategory = (category: SpaceCategory | null | undefined): SpacesModuleCreateSpaceCategory | undefined => {
	if (!category) return undefined;
	return category as unknown as SpacesModuleCreateSpaceCategory;
};

export const useSpacesOnboarding = () => {
	const backendClient = injectBackendClient();
	const { generate: uuid } = useUuid();

	const state = reactive<WizardState>({
		currentStep: 0,
		existingSpaces: [],
		spaces: [],
		proposedSpaces: [],
		customSpaces: [],
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
	const customSpaces = computed(() => state.customSpaces);
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
				type: SpaceType.ROOM,
				category: null,
			}));
		} catch (err) {
			state.error = err instanceof Error ? err.message : 'Unknown error';
			throw err;
		} finally {
			state.isLoading = false;
		}
	};

	const createDraftSpacesFromProposals = (): ISpace[] => {
		const createdSpaces: ISpace[] = [];
		const selectedProposals = state.proposedSpaces.filter((p) => p.selected);
		const selectedCustomSpaces = state.customSpaces.filter((c) => c.selected);

		// Create draft spaces from proposed spaces
		for (const proposal of selectedProposals) {
			// Check if space already exists (to prevent duplicates when going back/forward)
			const existingSpace = state.spaces.find((s) => s.name === proposal.name && s.draft);
			if (existingSpace) {
				// Pre-populate device assignments based on proposal
				for (const deviceId of proposal.deviceIds) {
					if (!state.deviceAssignments[deviceId]) {
						state.deviceAssignments[deviceId] = existingSpace.id;
					}
				}
				continue;
			}

			const space: ISpace = {
				id: uuid(),
				name: proposal.name,
				description: null,
				type: proposal.type,
				category: proposal.category,
				icon: null,
				displayOrder: 0,
				parentId: null,
				primaryThermostatId: null,
				primaryTemperatureSensorId: null,
				suggestionsEnabled: true,
				createdAt: new Date(),
				updatedAt: null,
				draft: true,
			};

			state.spaces = [...state.spaces, space];
			createdSpaces.push(space);

			// Pre-populate device assignments based on proposal
			for (const deviceId of proposal.deviceIds) {
				state.deviceAssignments[deviceId] = space.id;
			}

			// Mark proposal as no longer selected to prevent duplicate creation on back/next
			proposal.selected = false;
		}

		// Create draft spaces from custom spaces
		for (const customSpace of selectedCustomSpaces) {
			// Check if space already exists (to prevent duplicates when going back/forward)
			const existingSpace = state.spaces.find((s) => s.name === customSpace.name && s.draft);
			if (existingSpace) {
				continue;
			}

			const space: ISpace = {
				id: uuid(),
				name: customSpace.name,
				description: null,
				type: customSpace.type,
				category: customSpace.category,
				icon: null,
				displayOrder: 0,
				parentId: null,
				primaryThermostatId: null,
				primaryTemperatureSensorId: null,
				suggestionsEnabled: true,
				createdAt: new Date(),
				updatedAt: null,
				draft: true,
			};

			state.spaces = [...state.spaces, space];
			createdSpaces.push(space);

			// Mark custom space as no longer selected to prevent duplicate creation on back/next
			customSpace.selected = false;
		}

		return createdSpaces;
	};

	const createSpacesFromProposals = async (): Promise<ISpace[]> => {
		state.isLoading = true;
		state.error = null;

		const createdSpaces: ISpace[] = [];

		try {
			// Get all draft spaces that need to be converted to real spaces
			// Only convert drafts that are still in use (have assignments or are in selected proposals/custom spaces)
			const draftSpaces = state.spaces.filter((s) => s.draft);
			const selectedProposalNames = new Set(
				state.proposedSpaces.filter((p) => p.selected).map((p) => p.name)
			);
			// Check all custom spaces (not just selected ones) because selected flag is set to false
			// after draft creation to prevent duplicates, but we still want to preserve custom spaces
			const customSpaceNames = new Set(state.customSpaces.map((c) => c.name));
			const usedDraftSpaceIds = new Set(
				[...Object.values(state.deviceAssignments), ...Object.values(state.displayAssignments)].filter(
					(id): id is string => id !== null
				)
			);

			// Create spaces from draft spaces via API
			for (const draftSpace of draftSpaces) {
				// Only convert drafts that are still selected or have assignments or are custom spaces
				const isSelected = selectedProposalNames.has(draftSpace.name);
				const isCustomSpace = customSpaceNames.has(draftSpace.name);
				const hasAssignments = usedDraftSpaceIds.has(draftSpace.id);

				if (!isSelected && !isCustomSpace && !hasAssignments) {
					// Remove unused draft space
					state.spaces = state.spaces.filter((s) => s.id !== draftSpace.id);
					continue;
				}

				const response = await backendClient.POST('/modules/spaces/spaces', {
					body: {
						data: {
							name: draftSpace.name,
							type: spaceTypeToApiType(draftSpace.type),
							category: spaceCategoryToApiCategory(draftSpace.category),
						},
					},
				});

				if (response.error || !response.data?.data) {
					throw new SpacesApiException(`Failed to create space: ${draftSpace.name}`);
				}

				const space: ISpace = {
					id: response.data.data.id,
					name: response.data.data.name,
					description: response.data.data.description ?? null,
					type: apiTypeToSpaceType(response.data.data.type),
					category: apiCategoryToSpaceCategory(response.data.data.category),
					icon: response.data.data.icon ?? null,
					displayOrder: response.data.data.display_order ?? 0,
					parentId: response.data.data.parent_id ?? null,
					primaryThermostatId: response.data.data.primary_thermostat_id ?? null,
					primaryTemperatureSensorId: response.data.data.primary_temperature_sensor_id ?? null,
					suggestionsEnabled: response.data.data.suggestions_enabled ?? true,
					createdAt: new Date(response.data.data.created_at),
					updatedAt: response.data.data.updated_at ? new Date(response.data.data.updated_at) : null,
					draft: false,
				};

				// Update device assignments to use the new space ID
				for (const [deviceId, spaceId] of Object.entries(state.deviceAssignments)) {
					if (spaceId === draftSpace.id) {
						state.deviceAssignments[deviceId] = space.id;
					}
				}

				// Update display assignments to use the new space ID
				for (const [displayId, spaceId] of Object.entries(state.displayAssignments)) {
					if (spaceId === draftSpace.id) {
						state.displayAssignments[displayId] = space.id;
					}
				}

				// Replace draft space with real space
				const draftIndex = state.spaces.findIndex((s) => s.id === draftSpace.id);
				if (draftIndex !== -1) {
					state.spaces[draftIndex] = space;
				} else {
					state.spaces = [...state.spaces, space];
				}

				createdSpaces.push(space);
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
						category: spaceCategoryToApiCategory(data.category),
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
				parentId: response.data.data.parent_id ?? null,
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
		state.customSpaces.push({
			name,
			selected: true,
			type: SpaceType.ROOM,
			category: null,
		});
	};

	const removeProposedSpace = (index: number): void => {
		state.proposedSpaces.splice(index, 1);
	};

	const removeCustomSpace = (index: number): void => {
		state.customSpaces.splice(index, 1);
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
				description: d.description ?? null,
				spaceId: d.room_id ?? null,
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
				macAddress: d.mac_address ?? '',
				role: d.role ?? 'room',
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
				parentId: s.parent_id ?? null,
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
		customSpaces,
		deviceAssignments,
		displayAssignments,
		// Actions
		fetchProposedSpaces,
		fetchDevices,
		fetchDisplays,
		fetchExistingSpaces,
		createDraftSpacesFromProposals,
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
		removeCustomSpace,
		initializeFromExistingSpaces,
		initializeDeviceAssignments,
		initializeDisplayAssignments,
		getSummary,
	};
};
