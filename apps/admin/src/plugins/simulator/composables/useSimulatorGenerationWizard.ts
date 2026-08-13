import { type Ref, ref } from 'vue';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import { devicesStoreKey } from '../../../modules/devices';
import type { SchemaSimulatorPluginDataDeviceCategory, operations } from '../../../openapi';
import { type DevicesModuleDeviceCategory, SimulatorPluginBehaviorMode } from '../../../openapi.constants';
import { SIMULATOR_PLUGIN_PREFIX } from '../simulator.constants';

type CreateSimulatorDeviceOperation = operations['create-simulator-plugin-device'];
type GetSimulatorCategoriesOperation = operations['get-simulator-plugin-categories'];

export interface ISimulatorGenerationCategory {
	category: DevicesModuleDeviceCategory;
	name: string;
	description: string;
}

export interface ISimulatorGenerationOptions {
	category: DevicesModuleDeviceCategory;
	count: number;
	namePrefix: string;
	description?: string | null;
	roomId?: string | null;
	requiredChannelsOnly: boolean;
	requiredPropertiesOnly: boolean;
	autoSimulate: boolean;
	simulateInterval: number;
	behaviorMode: SimulatorPluginBehaviorMode;
}

export interface ISimulatorGenerationResult {
	name: string;
	success: boolean;
	deviceId?: string;
	error?: string;
}

export interface IUseSimulatorGenerationWizard {
	categories: Ref<ISimulatorGenerationCategory[]>;
	loadingCategories: Ref<boolean>;
	categoriesError: Ref<string | null>;
	results: Ref<ISimulatorGenerationResult[]>;
	generating: Ref<boolean>;
	generationError: Ref<string | null>;
	fetchCategories: () => Promise<void>;
	generate: (options: ISimulatorGenerationOptions) => Promise<void>;
	reset: () => void;
}

const MAX_COUNT = 20;
const MAX_CONCURRENCY = 3;

const errorMessage = (error: unknown, fallback: string): string => {
	if (error instanceof Error) {
		return error.message;
	}

	return fallback;
};

export const useSimulatorGenerationWizard = (): IUseSimulatorGenerationWizard => {
	const backend = useBackend();
	const logger = useLogger();
	const storesManager = injectStoresManager();
	const devicesStore = storesManager.getStore(devicesStoreKey);

	const categories = ref<ISimulatorGenerationCategory[]>([]);
	const loadingCategories = ref(false);
	const categoriesError = ref<string | null>(null);
	const results = ref<ISimulatorGenerationResult[]>([]);
	const generating = ref(false);
	const generationError = ref<string | null>(null);

	let categoriesLoaded = false;
	let categoriesRequest: Promise<void> | null = null;

	const fetchCategories = async (): Promise<void> => {
		if (categoriesLoaded) {
			return;
		}

		if (categoriesRequest !== null) {
			return categoriesRequest;
		}

		loadingCategories.value = true;
		categoriesError.value = null;

		categoriesRequest = (async (): Promise<void> => {
			try {
				const { data, error } = await backend.client.GET(`/${PLUGINS_PREFIX}/${SIMULATOR_PLUGIN_PREFIX}/simulator/categories`, {});

				if (typeof data === 'undefined') {
					const fallback = 'Failed to load simulator device categories';
					throw new Error(error ? getErrorReason<GetSimulatorCategoriesOperation>(error, fallback) : fallback);
				}

				categories.value = (data.data as SchemaSimulatorPluginDataDeviceCategory[]).map((category) => ({
					category: category.category as DevicesModuleDeviceCategory,
					name: category.name,
					description: category.description,
				}));
				categoriesLoaded = true;
			} catch (error: unknown) {
				categoriesError.value = errorMessage(error, 'Failed to load simulator device categories');
				throw error;
			} finally {
				loadingCategories.value = false;
				categoriesRequest = null;
			}
		})();

		return categoriesRequest;
	};

	const validateOptions = (options: ISimulatorGenerationOptions): string => {
		if (!Number.isInteger(options.count) || options.count < 1 || options.count > MAX_COUNT) {
			throw new RangeError(`Device count must be an integer between 1 and ${MAX_COUNT}`);
		}

		const namePrefix = options.namePrefix.trim();

		if (namePrefix.length === 0) {
			throw new Error('Device name prefix is required');
		}

		if (
			options.autoSimulate &&
			(!Number.isInteger(options.simulateInterval) || options.simulateInterval < 1_000 || options.simulateInterval > 60_000)
		) {
			throw new RangeError('Simulation interval must be an integer between 1000 and 60000 milliseconds');
		}

		return namePrefix;
	};

	const generate = async (options: ISimulatorGenerationOptions): Promise<void> => {
		if (generating.value) {
			throw new Error('Simulator device generation is already in progress');
		}

		results.value = [];
		generationError.value = null;

		let namePrefix: string;

		try {
			namePrefix = validateOptions(options);
		} catch (error: unknown) {
			generationError.value = errorMessage(error, 'Invalid simulator generation options');
			throw error;
		}

		const names = Array.from({ length: options.count }, (_, index) => (options.count === 1 ? namePrefix : `${namePrefix} ${index + 1}`));
		const generatedResults = new Array<ISimulatorGenerationResult>(names.length);
		let nextIndex = 0;

		generating.value = true;

		const worker = async (): Promise<void> => {
			while (nextIndex < names.length) {
				const index = nextIndex++;
				const name = names[index];

				try {
					const { data, error } = await backend.client.POST(`/${PLUGINS_PREFIX}/${SIMULATOR_PLUGIN_PREFIX}/simulator/generate`, {
						body: {
							data: {
								category: options.category,
								name,
								description: options.description ?? null,
								room_id: options.roomId ?? null,
								required_channels_only: options.requiredChannelsOnly,
								required_properties_only: options.requiredPropertiesOnly,
								auto_simulate: options.autoSimulate,
								...(options.autoSimulate ? { simulate_interval: options.simulateInterval } : {}),
								behavior_mode: options.behaviorMode,
							},
						},
					});

					if (typeof data === 'undefined') {
						const fallback = `Failed to generate ${name}`;
						generatedResults[index] = {
							name,
							success: false,
							error: error ? getErrorReason<CreateSimulatorDeviceOperation>(error, fallback) : fallback,
						};
						continue;
					}

					generatedResults[index] = {
						name,
						success: true,
						deviceId: data.data.id,
					};
				} catch (error: unknown) {
					generatedResults[index] = {
						name,
						success: false,
						error: errorMessage(error, `Failed to generate ${name}`),
					};
				}
			}
		};

		try {
			await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, names.length) }, () => worker()));
			results.value = generatedResults;

			if (generatedResults.some((result) => result.success)) {
				try {
					await devicesStore.fetch();
				} catch (error: unknown) {
					logger.warn('Simulator devices were generated, but the device store could not be refreshed', {
						message: errorMessage(error, 'Unknown device store refresh error'),
					});
				}
			}
		} finally {
			generating.value = false;
		}
	};

	const reset = (): void => {
		results.value = [];
		generationError.value = null;
	};

	return {
		categories,
		loadingCategories,
		categoriesError,
		results,
		generating,
		generationError,
		fetchCategories,
		generate,
		reset,
	};
};
