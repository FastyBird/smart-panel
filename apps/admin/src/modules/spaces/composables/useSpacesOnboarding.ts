import { computed, reactive } from 'vue';

import { injectBackendClient, useUuid } from '../../../common';
import {
	SpacesModuleCreateSpaceCategory,
	SpacesModuleCreateSpaceType,
	SpacesModuleDataSpaceCategory,
} from '../../../openapi';
import { ASSIGNABLE_ZONE_CATEGORIES, SpaceCategory, SpaceType, SPACE_CATEGORY_TEMPLATES } from '../spaces.constants';
import { SpacesApiException } from '../spaces.exceptions';
import { canonicalizeSpaceName } from '../spaces.utils';
import type { ISpace, ISpaceCreateData } from '../store';

interface ProposedSpace {
	name: string;
	description: string | null;
	icon: string | null;
	deviceIds: string[];
	deviceCount: number;
	selected: boolean;
	type: SpaceType;
	category: SpaceCategory | null;
	draftId: string; // Pre-generated UUID for draft space
	editing: boolean; // Is name being edited inline
	editName: string; // Temporary edit value
}

interface CustomSpace {
	name: string;
	description: string | null;
	icon: string | null;
	selected: boolean;
	type: SpaceType;
	category: SpaceCategory | null;
	draftId: string; // Pre-generated UUID for draft space
	editing: boolean; // Is name being edited inline
	editName: string; // Temporary edit value
}

/**
 * Represents a proposed space that matches an existing space
 */
export interface MatchedSpace {
	proposedName: string;
	existingSpace: ISpace;
	deviceIds: string[];
	deviceCount: number;
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
	matchedSpaces: MatchedSpace[]; // Proposed spaces that match existing spaces
	deviceAssignments: Record<string, string | null>; // deviceId -> spaceId (room)
	displayAssignments: Record<string, string | null>; // displayId -> spaceId
	zoneAssignments: Record<string, string[]>; // deviceId -> zoneIds[] (optional zone assignment)
	showAdvancedZones: boolean; // Toggle for advanced zone column in Step 3
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
		matchedSpaces: [],
		deviceAssignments: {},
		displayAssignments: {},
		zoneAssignments: {},
		showAdvancedZones: false,
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
	const matchedSpaces = computed(() => state.matchedSpaces);
	const deviceAssignments = computed(() => state.deviceAssignments);
	const displayAssignments = computed(() => state.displayAssignments);
	const zoneAssignments = computed(() => state.zoneAssignments);
	const showAdvancedZones = computed({
		get: () => state.showAdvancedZones,
		set: (val: boolean) => {
			state.showAdvancedZones = val;
		},
	});

	/**
	 * Get zones that can be assigned to devices (excludes floor_* categories)
	 */
	const assignableZones = computed(() =>
		availableSpaces.value.filter(
			(space) =>
				space.type === SpaceType.ZONE &&
				space.category &&
				(ASSIGNABLE_ZONE_CATEGORIES as readonly SpaceCategory[]).includes(space.category)
		)
	);

	/**
	 * Proposed spaces that don't match existing spaces (will be created)
	 */
	const unmatchedProposals = computed(() =>
		state.proposedSpaces.filter(
			(p) =>
				!state.matchedSpaces.some(
					(m) => canonicalizeSpaceName(m.proposedName) === canonicalizeSpaceName(p.name)
				)
		)
	);

	/**
	 * All available spaces for Steps 2 & 3 (existing + created, deduplicated by ID)
	 */
	const availableSpaces = computed(() => {
		const map = new Map<string, ISpace>();
		// Add existing spaces
		for (const space of state.existingSpaces) {
			map.set(space.id, space);
		}
		// Add created/draft spaces
		for (const space of state.spaces) {
			map.set(space.id, space);
		}
		return Array.from(map.values());
	});

	const fetchProposedSpaces = async (): Promise<void> => {
		state.isLoading = true;
		state.error = null;

		try {
			const response = await backendClient.GET('/modules/spaces/spaces/propose');

			if (response.error || !response.data?.data) {
				throw new SpacesApiException('Failed to fetch proposed spaces');
			}

			const allProposals = response.data.data.map((p) => {
				const category = apiCategoryToSpaceCategory(p.category);
				// Get default description and icon from category template
				const template = category ? SPACE_CATEGORY_TEMPLATES[category] : null;
				const defaultDescription = template?.description ?? null;
				const defaultIcon = template?.icon ?? null;
				const name = p.name ?? '';
				return {
					name,
					description: defaultDescription,
					icon: defaultIcon,
					deviceIds: p.device_ids ?? [],
					deviceCount: p.device_count ?? 0,
					selected: true,
					type: p.type ? apiTypeToSpaceType(p.type) : SpaceType.ROOM,
					category,
					draftId: uuid(), // Pre-generate UUID for draft space
					editing: false,
					editName: name,
				};
			});

			// Detect matches with existing spaces
			state.matchedSpaces = [];
			const unmatchedProposals: typeof allProposals = [];

			for (const proposal of allProposals) {
				const canonicalProposalName = canonicalizeSpaceName(proposal.name);
				const matchedExisting = state.existingSpaces.find(
					(existing) => canonicalizeSpaceName(existing.name) === canonicalProposalName
				);

				if (matchedExisting) {
					// This proposal matches an existing space
					state.matchedSpaces.push({
						proposedName: proposal.name,
						existingSpace: matchedExisting,
						deviceIds: proposal.deviceIds,
						deviceCount: proposal.deviceCount,
					});
				} else {
					// This proposal doesn't match any existing space
					unmatchedProposals.push(proposal);
				}
			}

			// Only store unmatched proposals in proposedSpaces
			state.proposedSpaces = unmatchedProposals;
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

		// Pre-populate device assignments for matched spaces (proposals matching existing spaces)
		// Only for rooms, not zones (zones cannot have devices directly assigned)
		for (const matched of state.matchedSpaces) {
			if (matched.existingSpace.type === SpaceType.ROOM) {
				for (const deviceId of matched.deviceIds) {
					if (!state.deviceAssignments[deviceId]) {
						state.deviceAssignments[deviceId] = matched.existingSpace.id;
					}
				}
			}
		}

		// Create draft spaces from proposed spaces
		for (const proposal of selectedProposals) {
			// Check if draft already exists (to prevent duplicates when going back/forward)
			const existingDraft = state.spaces.find((s) => s.id === proposal.draftId);
			if (existingDraft) {
				// Pre-populate device assignments based on proposal (only for rooms, not zones)
				if (proposal.type === SpaceType.ROOM) {
					for (const deviceId of proposal.deviceIds) {
						if (!state.deviceAssignments[deviceId]) {
							state.deviceAssignments[deviceId] = existingDraft.id;
						}
					}
				}
				continue;
			}

			const space: ISpace = {
				id: proposal.draftId, // Use pre-generated UUID
				name: proposal.name,
				description: proposal.description,
				type: proposal.type,
				category: proposal.category,
				icon: proposal.icon,
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

			// Pre-populate device assignments based on proposal (only for rooms, not zones)
			if (proposal.type === SpaceType.ROOM) {
				for (const deviceId of proposal.deviceIds) {
					state.deviceAssignments[deviceId] = space.id;
				}
			}
		}

		// Create draft spaces from custom spaces
		for (const customSpace of selectedCustomSpaces) {
			// Check if draft already exists (to prevent duplicates when going back/forward)
			const existingDraft = state.spaces.find((s) => s.id === customSpace.draftId);
			if (existingDraft) {
				continue;
			}

			const space: ISpace = {
				id: customSpace.draftId, // Use pre-generated UUID
				name: customSpace.name,
				description: customSpace.description,
				type: customSpace.type,
				category: customSpace.category,
				icon: customSpace.icon,
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
							description: draftSpace.description,
							icon: draftSpace.icon,
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

	/**
	 * Clear all device and display assignments pointing to a specific space
	 */
	const clearAssignmentsForSpace = (spaceId: string): void => {
		// Clear all device assignments pointing to this space
		for (const [deviceId, assignedSpaceId] of Object.entries(state.deviceAssignments)) {
			if (assignedSpaceId === spaceId) {
				state.deviceAssignments[deviceId] = null;
			}
		}
		// Clear all display assignments pointing to this space
		for (const [displayId, assignedSpaceId] of Object.entries(state.displayAssignments)) {
			if (assignedSpaceId === spaceId) {
				state.displayAssignments[displayId] = null;
			}
		}
	};

	const toggleProposedSpace = (index: number): void => {
		const proposal = state.proposedSpaces[index];
		if (proposal) {
			proposal.selected = !proposal.selected;

			// Sync draft space with selection state
			if (!proposal.selected) {
				// Remove draft and clear ALL assignments when unchecked
				state.spaces = state.spaces.filter((s) => s.id !== proposal.draftId);
				clearAssignmentsForSpace(proposal.draftId);
			}
		}
	};

	const toggleCustomSpace = (index: number): void => {
		const customSpace = state.customSpaces[index];
		if (customSpace) {
			customSpace.selected = !customSpace.selected;

			// Sync draft space with selection state
			if (!customSpace.selected) {
				// Remove draft and clear ALL assignments when unchecked
				state.spaces = state.spaces.filter((s) => s.id !== customSpace.draftId);
				clearAssignmentsForSpace(customSpace.draftId);
			}
		}
	};

	/**
	 * Check if a space name is a duplicate of an existing, proposed, or custom space
	 * @returns The name of the conflicting space if duplicate, null otherwise
	 */
	const checkDuplicateSpaceName = (name: string): string | null => {
		const canonicalName = canonicalizeSpaceName(name);

		// Check existing spaces
		const existingMatch = state.existingSpaces.find(
			(s) => canonicalizeSpaceName(s.name) === canonicalName
		);
		if (existingMatch) {
			return existingMatch.name;
		}

		// Check proposed spaces
		const proposedMatch = state.proposedSpaces.find(
			(p) => canonicalizeSpaceName(p.name) === canonicalName
		);
		if (proposedMatch) {
			return proposedMatch.name;
		}

		// Check custom spaces
		const customMatch = state.customSpaces.find(
			(c) => canonicalizeSpaceName(c.name) === canonicalName
		);
		if (customMatch) {
			return customMatch.name;
		}

		return null;
	};

	const addManualSpace = (name: string): { success: boolean; duplicateOf?: string } => {
		// Check for duplicates
		const duplicate = checkDuplicateSpaceName(name);
		if (duplicate) {
			return { success: false, duplicateOf: duplicate };
		}

		state.customSpaces.push({
			name,
			description: null,
			icon: null,
			selected: true,
			type: SpaceType.ROOM,
			category: null,
			draftId: uuid(), // Pre-generate UUID for draft space
			editing: false,
			editName: name,
		});

		return { success: true };
	};

	const removeProposedSpace = (index: number): void => {
		const proposal = state.proposedSpaces[index];
		if (proposal) {
			// Remove draft and clear ALL assignments
			state.spaces = state.spaces.filter((s) => s.id !== proposal.draftId);
			clearAssignmentsForSpace(proposal.draftId);
		}
		state.proposedSpaces.splice(index, 1);
	};

	const removeCustomSpace = (index: number): void => {
		const customSpace = state.customSpaces[index];
		if (customSpace) {
			// Remove draft and clear ALL assignments
			state.spaces = state.spaces.filter((s) => s.id !== customSpace.draftId);
			clearAssignmentsForSpace(customSpace.draftId);
		}
		state.customSpaces.splice(index, 1);
	};

	// ─────────────────────────────────────────────────────────────────────────────
	// Inline name editing methods
	// ─────────────────────────────────────────────────────────────────────────────

	const startEditingProposedName = (index: number): void => {
		const proposal = state.proposedSpaces[index];
		if (proposal) {
			proposal.editing = true;
			proposal.editName = proposal.name;
		}
	};

	const confirmProposedNameEdit = (
		index: number
	): { success: boolean; convertedToMatch?: boolean; duplicateOf?: string } => {
		const proposal = state.proposedSpaces[index];
		if (!proposal) {
			return { success: false };
		}

		const newName = proposal.editName.trim();

		// Revert if empty
		if (!newName) {
			proposal.editing = false;
			proposal.editName = proposal.name;
			return { success: false };
		}

		// If name unchanged, just close edit mode
		if (newName === proposal.name) {
			proposal.editing = false;
			return { success: true };
		}

		// Check for dedupe match with existing spaces
		const canonicalNew = canonicalizeSpaceName(newName);
		const existingMatch = state.existingSpaces.find(
			(s) => canonicalizeSpaceName(s.name) === canonicalNew
		);

		if (existingMatch) {
			// Convert to matched space
			state.matchedSpaces.push({
				proposedName: newName,
				existingSpace: existingMatch,
				deviceIds: proposal.deviceIds,
				deviceCount: proposal.deviceCount,
			});
			// Remove from proposed
			state.proposedSpaces.splice(index, 1);
			return { success: true, convertedToMatch: true };
		}

		// Check for duplicate with other proposals/custom (excluding self)
		const duplicateProposal = state.proposedSpaces.find(
			(p, i) => i !== index && canonicalizeSpaceName(p.name) === canonicalNew
		);
		if (duplicateProposal) {
			proposal.editing = false;
			proposal.editName = proposal.name;
			return { success: false, duplicateOf: duplicateProposal.name };
		}

		const duplicateCustom = state.customSpaces.find(
			(c) => canonicalizeSpaceName(c.name) === canonicalNew
		);
		if (duplicateCustom) {
			proposal.editing = false;
			proposal.editName = proposal.name;
			return { success: false, duplicateOf: duplicateCustom.name };
		}

		// Apply the rename
		proposal.name = newName;
		proposal.editing = false;

		// Also update the draft space name if it exists
		const draftSpace = state.spaces.find((s) => s.id === proposal.draftId);
		if (draftSpace) {
			draftSpace.name = newName;
		}

		return { success: true };
	};

	const discardProposedNameEdit = (index: number): void => {
		const proposal = state.proposedSpaces[index];
		if (proposal) {
			proposal.editing = false;
			proposal.editName = proposal.name;
		}
	};

	const startEditingCustomName = (index: number): void => {
		const customSpace = state.customSpaces[index];
		if (customSpace) {
			customSpace.editing = true;
			customSpace.editName = customSpace.name;
		}
	};

	const confirmCustomNameEdit = (
		index: number
	): { success: boolean; convertedToMatch?: boolean; duplicateOf?: string } => {
		const customSpace = state.customSpaces[index];
		if (!customSpace) {
			return { success: false };
		}

		const newName = customSpace.editName.trim();

		// Revert if empty
		if (!newName) {
			customSpace.editing = false;
			customSpace.editName = customSpace.name;
			return { success: false };
		}

		// If name unchanged, just close edit mode
		if (newName === customSpace.name) {
			customSpace.editing = false;
			return { success: true };
		}

		// Check for dedupe match with existing spaces
		const canonicalNew = canonicalizeSpaceName(newName);
		const existingMatch = state.existingSpaces.find(
			(s) => canonicalizeSpaceName(s.name) === canonicalNew
		);

		if (existingMatch) {
			// Convert to matched space (custom spaces don't have device IDs)
			state.matchedSpaces.push({
				proposedName: newName,
				existingSpace: existingMatch,
				deviceIds: [],
				deviceCount: 0,
			});
			// Remove from custom
			state.customSpaces.splice(index, 1);
			return { success: true, convertedToMatch: true };
		}

		// Check for duplicate with proposals/other customs (excluding self)
		const duplicateProposal = state.proposedSpaces.find(
			(p) => canonicalizeSpaceName(p.name) === canonicalNew
		);
		if (duplicateProposal) {
			customSpace.editing = false;
			customSpace.editName = customSpace.name;
			return { success: false, duplicateOf: duplicateProposal.name };
		}

		const duplicateCustom = state.customSpaces.find(
			(c, i) => i !== index && canonicalizeSpaceName(c.name) === canonicalNew
		);
		if (duplicateCustom) {
			customSpace.editing = false;
			customSpace.editName = customSpace.name;
			return { success: false, duplicateOf: duplicateCustom.name };
		}

		// Apply the rename
		customSpace.name = newName;
		customSpace.editing = false;

		// Also update the draft space name if it exists
		const draftSpace = state.spaces.find((s) => s.id === customSpace.draftId);
		if (draftSpace) {
			draftSpace.name = newName;
		}

		return { success: true };
	};

	const discardCustomNameEdit = (index: number): void => {
		const customSpace = state.customSpaces[index];
		if (customSpace) {
			customSpace.editing = false;
			customSpace.editName = customSpace.name;
		}
	};

	// ─────────────────────────────────────────────────────────────────────────────
	// Zone assignment methods
	// ─────────────────────────────────────────────────────────────────────────────

	const setDeviceZones = (deviceId: string, zoneIds: string[]): void => {
		state.zoneAssignments[deviceId] = zoneIds;
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

		// Count devices assigned to rooms
		for (const spaceId of Object.values(state.deviceAssignments)) {
			if (spaceId) {
				devicesBySpace[spaceId] = (devicesBySpace[spaceId] ?? 0) + 1;
			}
		}

		// Count devices assigned to zones (from advanced mode)
		for (const zoneIds of Object.values(state.zoneAssignments)) {
			for (const zoneId of zoneIds) {
				devicesBySpace[zoneId] = (devicesBySpace[zoneId] ?? 0) + 1;
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
		matchedSpaces,
		unmatchedProposals,
		availableSpaces,
		deviceAssignments,
		displayAssignments,
		zoneAssignments,
		showAdvancedZones,
		assignableZones,
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
		setDeviceZones,
		applyAssignments,
		setStep,
		nextStep,
		prevStep,
		toggleProposedSpace,
		toggleCustomSpace,
		addManualSpace,
		checkDuplicateSpaceName,
		removeProposedSpace,
		removeCustomSpace,
		startEditingProposedName,
		confirmProposedNameEdit,
		discardProposedNameEdit,
		startEditingCustomName,
		confirmCustomNameEdit,
		discardCustomNameEdit,
		initializeFromExistingSpaces,
		initializeDeviceAssignments,
		initializeDisplayAssignments,
		getSummary,
	};
};
