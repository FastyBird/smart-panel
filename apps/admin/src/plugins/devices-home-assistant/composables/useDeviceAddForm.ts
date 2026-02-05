import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, getSchemaDefaults, useFlashMessage, useLogger } from '../../../common';
import { FormResult, type FormResultType, type IDevice } from '../../../modules/devices';
import { DevicesApiException } from '../../../modules/devices/devices.exceptions';
import { DevicesModuleChannelCategory, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException, DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import { HomeAssistantDeviceAddFormSchema } from '../schemas/devices.schemas';
import type { IHomeAssistantDeviceAddForm } from '../schemas/devices.types';
import type { IAdoptDeviceRequest, IMappingPreviewRequest, IMappingPreviewResponse } from '../schemas/mapping-preview.types';

import type { IUseDeviceAddForm } from './types';
import { useDeviceAdoption } from './useDeviceAdoption';
import { useDiscoveredItemsOptions } from './useDiscoveredItemsOptions';
import { type ItemType, useMappingPreview } from './useMappingPreview';

interface IUseDeviceAddFormProps {
	id: IDevice['id'];
}

export const useDeviceAddForm = ({ id }: IUseDeviceAddFormProps): IUseDeviceAddForm<IHomeAssistantDeviceAddForm> => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const { preview, isLoading: isPreviewLoading, error: previewError, itemType, fetchPreview, clearPreview } = useMappingPreview();
	const { isAdopting, error: adoptionError, adoptDevice } = useDeviceAdoption();
	const { itemsOptions, areLoading: itemsOptionsLoading } = useDiscoveredItemsOptions();

	// Helper function to get item type from selected value
	const getItemTypeFromSelection = (selectedId: string): ItemType => {
		for (const group of itemsOptions.value) {
			const item = group.options.find((opt) => opt.value === selectedId);
			if (item) {
				return item.type;
			}
		}
		return 'device'; // Default to device
	};

	const categoriesOptions = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(() => {
		return Object.values(DevicesModuleDeviceCategory)
			.filter((value) => value !== DevicesModuleDeviceCategory.generic)
			.map((value) => ({
				value,
				label: t(`devicesModule.categories.devices.${value}`),
			}));
	});

	const model = reactive<IHomeAssistantDeviceAddForm>({
		...getSchemaDefaults(HomeAssistantDeviceAddFormSchema),
		id,
		type: DEVICES_HOME_ASSISTANT_TYPE,
		// Don't default to generic - use first non-generic category or let user select
		category: Object.values(DevicesModuleDeviceCategory).find((c) => c !== DevicesModuleDeviceCategory.generic) || DevicesModuleDeviceCategory.sensor,
		name: '',
		description: '',
		enabled: true,
		haDeviceId: '',
	});

	const initialModel: Reactive<IHomeAssistantDeviceAddForm> = deepClone<Reactive<IHomeAssistantDeviceAddForm>>(toRaw(model));

	const stepOneFormEl = ref<FormInstance | undefined>(undefined);
	const stepTwoFormEl = ref<FormInstance | undefined>(undefined);
	const stepThreeFormEl = ref<FormInstance | undefined>(undefined);
	const stepFourFormEl = ref<FormInstance | undefined>(undefined);
	const stepFiveFormEl = ref<FormInstance | undefined>(undefined);

	const activeStep = ref<'one' | 'two' | 'three' | 'four' | 'five'>('one');
	const reachedSteps = ref<Set<'one' | 'two' | 'three' | 'four' | 'five'>>(new Set(['one']));

	const formChanged = ref<boolean>(false);

	const entityOverrides = ref<IMappingPreviewRequest['entityOverrides']>([]);
	const suggestedCategory = ref<DevicesModuleDeviceCategory | null>(null);

	const submitStep = async (step: 'one' | 'two' | 'three' | 'four' | 'five', formEl?: FormInstance): Promise<'ok' | 'added'> => {
		if (step === 'one') {
			const form = formEl || stepOneFormEl.value;
			if (!form) {
				throw new DevicesHomeAssistantValidationException('Form reference not available');
			}

			form.clearValidate();

			const valid = await form.validate();

			if (!valid) throw new DevicesHomeAssistantValidationException('Form not valid');

			formResult.value = FormResult.WORKING;

			try {
				// Determine item type from selection
				const selectedItemType = getItemTypeFromSelection(model.haDeviceId);

				// Fetch mapping preview without category to get suggestion
				await fetchPreview(model.haDeviceId, undefined, selectedItemType);

				// Auto-populate device info from preview
				if (preview.value) {
					model.name = preview.value.haDevice.name || model.name;
					suggestedCategory.value = preview.value.suggestedDevice.category;
					// Only set category if it's not generic (generic should not be used)
					const suggestedCat = preview.value.suggestedDevice.category;
					if (suggestedCat !== DevicesModuleDeviceCategory.generic) {
						model.category = suggestedCat;
					}
				}

				activeStep.value = 'two';
				reachedSteps.value.add('two');

				formResult.value = FormResult.NONE;

				return 'ok';
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesHomeAssistantValidationException) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(t('devicesHomeAssistantPlugin.messages.mapping.previewError'));
				}

				throw error;
			}
		} else if (step === 'two') {
			// Step 2: Category selection - validate and fetch preview with selected category
			const form = formEl || stepTwoFormEl.value;
			if (!form) {
				throw new DevicesHomeAssistantValidationException('Form reference not available');
			}

			form.clearValidate();

			const valid = await form.validate();

			if (!valid) throw new DevicesHomeAssistantValidationException('Form not valid');

			formResult.value = FormResult.WORKING;

			try {
				// Fetch mapping preview with selected category (use stored item type)
				await fetchPreview(
					model.haDeviceId,
					{
						deviceCategory: model.category,
					},
					itemType.value
				);

				// Auto-populate device name from preview if not set
				if (preview.value && !model.name) {
					model.name = preview.value.haDevice.name || model.name;
				}

				activeStep.value = 'three';
				reachedSteps.value.add('three');

				formResult.value = FormResult.NONE;

				return 'ok';
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesHomeAssistantValidationException) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(t('devicesHomeAssistantPlugin.messages.mapping.previewError'));
				}

				throw error;
			}
		} else if (step === 'three') {
			// Step 3 is just preview, no validation needed
			// User can proceed to step 4 or go back
			activeStep.value = 'four';
			reachedSteps.value.add('four');

			return 'ok';
		} else if (step === 'four') {
			// Step 4 is customization - validate that enabled entities have channelCategory selected
			const form = formEl || stepFourFormEl.value;
			if (!form) {
				throw new DevicesHomeAssistantValidationException('Form reference not available');
			}

			form.clearValidate();

			formResult.value = FormResult.WORKING;

			try {
				// Validate that all enabled entities have a channelCategory selected
				// This prevents sending invalid entityOverrides like { entityId } without a category
				if (preview.value) {
					const invalidEntities: string[] = [];

					for (const entity of preview.value.entities) {
						const override = entityOverrides.value?.find((o) => o.entityId === entity.entityId);

						// Skip validation for explicitly skipped entities
						if (override?.skip === true) {
							continue;
						}

						// Check if entity has a valid channelCategory
						// Entity has a category if:
						// 1. Override has channelCategory, OR
						// 2. No override but entity has valid suggested category (not generic)
						const hasOverrideCategory = override?.channelCategory !== undefined;
						const suggestedCategory = entity.suggestedChannel?.category;
						const hasValidSuggestedCategory = suggestedCategory !== undefined && suggestedCategory !== DevicesModuleChannelCategory.generic;

						// Entity is enabled but missing a category
						// This happens when override exists without skip and without channelCategory
						// AND entity doesn't have a valid suggested category to fall back to
						// This creates invalid overrides like { entityId } which can cause adoption to fail
						const isEnabledWithoutCategory = override && !override.skip && !hasOverrideCategory && !hasValidSuggestedCategory;

						if (isEnabledWithoutCategory) {
							invalidEntities.push(entity.entityId);
						}
					}

					if (invalidEntities.length > 0) {
						// Trigger validation errors on the form fields
						await form.validate().catch(() => {
							// Validation will fail, which is expected
						});

						// Show error message
						const entityList = invalidEntities.slice(0, 3).join(', ');
						const moreCount = invalidEntities.length > 3 ? ` (+${invalidEntities.length - 3} more)` : '';
						throw new DevicesHomeAssistantValidationException(
							t('devicesHomeAssistantPlugin.messages.mapping.missingChannelCategory', {
								entities: entityList + moreCount,
							})
						);
					}
				}

				const valid = await form.validate();

				if (!valid) {
					throw new DevicesHomeAssistantValidationException('Form not valid');
				}

				// If user made changes, update preview before proceeding
				if (entityOverrides.value && entityOverrides.value.length > 0) {
					const overrides: IMappingPreviewRequest = {
						entityOverrides: entityOverrides.value,
						deviceCategory: model.category,
					};

					await fetchPreview(model.haDeviceId, overrides, itemType.value);
				}

				// Proceed to next step
				activeStep.value = 'five';
				reachedSteps.value.add('five');

				formResult.value = FormResult.NONE;

				return 'ok';
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesHomeAssistantValidationException) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(t('devicesHomeAssistantPlugin.messages.mapping.previewError'));
				}

				throw error;
			}
		} else if (step === 'five') {
			// Check preview and readiness FIRST - before any form validation
			// This prevents wasting time on validation if the device isn't ready to adopt
			if (!preview.value) {
				throw new DevicesHomeAssistantValidationException('Mapping preview is required for device adoption.');
			}

			// Enforce readyToAdopt check - this is critical to prevent adoption of incomplete mappings
			// Use explicit strict equality check to ensure we only proceed when readyToAdopt is explicitly true
			if (preview.value.readyToAdopt !== true) {
				throw new DevicesHomeAssistantValidationException(t('devicesHomeAssistantPlugin.messages.mapping.notReadyToAdopt'));
			}

			const form = formEl || stepFiveFormEl.value;
			if (!form) {
				throw new DevicesHomeAssistantValidationException('Form reference not available');
			}

			form.clearValidate();

			const valid = await form.validate();

			if (!valid) {
				throw new DevicesHomeAssistantValidationException('Form not valid');
			}

			const parsedModel = HomeAssistantDeviceAddFormSchema.safeParse(model);

			if (!parsedModel.success) {
				logger.error('Schema validation failed with:', parsedModel.error);

				throw new DevicesHomeAssistantValidationException('Failed to validate create device model.');
			}

			formResult.value = FormResult.WORKING;

			const errorMessage = t('devicesHomeAssistantPlugin.messages.devices.notCreated', { device: model.name });

			try {
				// Defensive check: Re-verify readyToAdopt before building adoption request
				// This prevents race conditions or stale preview data from allowing adoption
				if (!preview.value || preview.value.readyToAdopt !== true) {
					throw new DevicesHomeAssistantValidationException(t('devicesHomeAssistantPlugin.messages.mapping.notReadyToAdopt'));
				}

				// Build adoption request from preview and model

				// Build channels from preview entities
				// Use overrides if available, otherwise use suggested channel
				// Filter out: skipped entities, channels with no properties, channels with generic category
				const channels = preview.value.entities
					.filter((entity) => {
						// Skip if explicitly skipped or incompatible with device category
						if (entity.status === 'skipped' || entity.status === 'incompatible') {
							return false;
						}
						// Check if there's an override that skips this entity
						const override = entityOverrides.value?.find((o) => o.entityId === entity.entityId);
						if (override?.skip) {
							return false;
						}
						// Must have a suggested channel or an override with category
						if (!entity.suggestedChannel && !override?.channelCategory) {
							return false;
						}
						// Calculate what the final channel category would be
						const finalChannelCategory = override?.channelCategory || entity.suggestedChannel?.category;
						// Filter out entities whose final category is generic (not supported)
						if (finalChannelCategory === DevicesModuleChannelCategory.generic) {
							return false;
						}
						// Must have at least one property
						if (!entity.suggestedProperties || entity.suggestedProperties.length === 0) {
							return false;
						}
						return true;
					})
					.map((entity) => {
						const override = entityOverrides.value?.find((o) => o.entityId === entity.entityId);
						const channelCategory = override?.channelCategory || entity.suggestedChannel!.category;
						const channelName = entity.suggestedChannel?.name || entity.entityId;

						return {
							entityId: entity.entityId,
							category: channelCategory,
							name: channelName,
							properties: entity.suggestedProperties.map((prop) => ({
								category: prop.category,
								haAttribute: prop.haAttribute,
								dataType: prop.dataType,
								permissions: prop.permissions,
								format: prop.format ?? null,
								// Include entity ID for consolidated channels (each property can map to a different entity)
								// Use prop.haEntityId if available (from mapping preview), otherwise fallback to entity.entityId
								haEntityId: prop.haEntityId ?? entity.entityId,
								// Include transformer from YAML mapping if specified
								haTransformer: prop.haTransformer ?? null,
							})),
						};
					});

				const adoptRequest: IAdoptDeviceRequest = {
					haDeviceId: model.haDeviceId,
					name: model.name,
					category: model.category,
					description: model.description ?? null,
					enabled: model.enabled,
					channels,
				};

				// Adopt the device/helper using the stored item type
				await adoptDevice(adoptRequest, itemType.value);

				formResult.value = FormResult.OK;

				timer = window.setTimeout(clear, 2000);

				flashMessage.success(
					t('devicesHomeAssistantPlugin.messages.mapping.adoptionSuccess', {
						device: model.name,
					})
				);

				// Navigation to devices list is handled by the parent view (view-device-add.vue)
				// when it detects formResult === FormResult.OK

				return 'added';
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				// Error message is already displayed by useDeviceAdoption composable
				// Don't show duplicate error messages here
				// Only log for debugging if it's an unexpected error type
				if (
					!(error instanceof DevicesHomeAssistantApiException) &&
					!(error instanceof DevicesHomeAssistantValidationException) &&
					!(error instanceof DevicesApiException)
				) {
					logger.error('Unexpected error during device adoption:', error);
					// Only show generic error for truly unexpected errors
					flashMessage.error(errorMessage);
				}

				throw error;
			}
		} else {
			throw new DevicesHomeAssistantValidationException('Unknown step');
		}
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	watch(
		(): string => model.haDeviceId,
		(val: string, oldValue: string): void => {
			if (val !== oldValue) {
				clearPreview();
				entityOverrides.value = [];
			}
		}
	);

	watch(
		(): IMappingPreviewResponse | null => preview.value,
		(val: IMappingPreviewResponse | null): void => {
			if (val) {
				// Auto-populate device name from preview if not set
				if (!model.name) {
					model.name = val.haDevice.name || model.name;
				}
				// Don't auto-update category after step 2 - user has selected it
			}
		}
	);

	return {
		categoriesOptions,
		activeStep,
		reachedSteps,
		preview,
		suggestedCategory,
		isPreviewLoading,
		previewError,
		isAdopting,
		adoptionError,
		itemsOptions,
		itemsOptionsLoading,
		entityOverrides,
		model,
		stepOneFormEl,
		stepTwoFormEl,
		stepThreeFormEl,
		stepFourFormEl,
		stepFiveFormEl,
		formChanged,
		submitStep,
		clear,
		clearPreview,
		formResult,
	};
};
