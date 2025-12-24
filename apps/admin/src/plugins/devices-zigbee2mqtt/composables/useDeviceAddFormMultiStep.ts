import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, getSchemaDefaults, router, useFlashMessage, useLogger } from '../../../common';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../../openapi.constants';
import { FormResult, type FormResultType, type IDevice, RouteNames as DevicesRouteNames } from '../../../modules/devices';
import { DevicesApiException } from '../../../modules/devices/devices.exceptions';
import { DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import { DevicesZigbee2mqttApiException, DevicesZigbee2mqttValidationException } from '../devices-zigbee2mqtt.exceptions';
import { Zigbee2mqttDeviceAddMultiStepFormSchema } from '../schemas/devices.schemas';
import type { IZigbee2mqttDeviceAddMultiStepForm } from '../schemas/devices.types';
import type {
	IAdoptDeviceRequest,
	IMappingExposeOverride,
	IMappingPreviewRequest,
	IMappingPreviewResponse,
} from '../schemas/mapping-preview.types';

import type { IUseDeviceAddFormMultiStep } from './types';
import { useDeviceAdoption } from './useDeviceAdoption';
import { useDiscoveredDevicesOptions } from './useDiscoveredDevicesOptions';
import { useMappingPreview } from './useMappingPreview';

interface IUseDeviceAddFormMultiStepProps {
	id: IDevice['id'];
}

export const useDeviceAddFormMultiStep = ({ id }: IUseDeviceAddFormMultiStepProps): IUseDeviceAddFormMultiStep => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const { preview, isLoading: isPreviewLoading, error: previewError, fetchPreview, clearPreview } = useMappingPreview();
	const { isAdopting, adoptDevice } = useDeviceAdoption();
	const { devicesOptions, devicesOptionsLoading } = useDiscoveredDevicesOptions();

	const categoriesOptions = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(() => {
		return Object.values(DevicesModuleDeviceCategory)
			.filter((value) => value !== DevicesModuleDeviceCategory.generic)
			.map((value) => ({
				value,
				label: t(`devicesModule.categories.devices.${value}`),
			}));
	});

	const model = reactive<IZigbee2mqttDeviceAddMultiStepForm>({
		...getSchemaDefaults(Zigbee2mqttDeviceAddMultiStepFormSchema),
		id,
		type: DEVICES_ZIGBEE2MQTT_TYPE,
		category:
			Object.values(DevicesModuleDeviceCategory).find((c) => c !== DevicesModuleDeviceCategory.generic) ||
			DevicesModuleDeviceCategory.sensor,
		name: '',
		description: '',
		enabled: true,
		ieeeAddress: '',
	});

	const initialModel: Reactive<IZigbee2mqttDeviceAddMultiStepForm> = deepClone<Reactive<IZigbee2mqttDeviceAddMultiStepForm>>(
		toRaw(model)
	);

	const activeStep = ref<'one' | 'two' | 'three' | 'four' | 'five'>('one');
	const reachedSteps = ref<Set<'one' | 'two' | 'three' | 'four' | 'five'>>(new Set(['one']));

	const formChanged = ref<boolean>(false);

	const exposeOverrides = ref<IMappingExposeOverride[]>([]);
	const suggestedCategory = ref<DevicesModuleDeviceCategory | null>(null);

	const submitStep = async (
		step: 'one' | 'two' | 'three' | 'four' | 'five',
		formEl?: FormInstance
	): Promise<'ok' | 'added'> => {
		if (step === 'one') {
			const form = formEl;
			if (!form) {
				throw new DevicesZigbee2mqttValidationException('Form reference not available');
			}

			form.clearValidate();

			const valid = await form.validate();

			if (!valid) throw new DevicesZigbee2mqttValidationException('Form not valid');

			formResult.value = FormResult.WORKING;

			try {
				// Fetch mapping preview without category to get suggestion
				await fetchPreview(model.ieeeAddress);

				// Auto-populate device info from preview
				if (preview.value) {
					model.name = preview.value.suggestedDevice.name || model.name;
					suggestedCategory.value = preview.value.suggestedDevice.category;
					// Only set category if it's not generic
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

				if (error instanceof DevicesZigbee2mqttValidationException) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(t('devicesZigbee2mqttPlugin.messages.mapping.previewError'));
				}

				throw error;
			}
		} else if (step === 'two') {
			// Step 2: Category selection - validate and fetch preview with selected category
			const form = formEl;
			if (!form) {
				throw new DevicesZigbee2mqttValidationException('Form reference not available');
			}

			form.clearValidate();

			const valid = await form.validate();

			if (!valid) throw new DevicesZigbee2mqttValidationException('Form not valid');

			formResult.value = FormResult.WORKING;

			try {
				// Fetch mapping preview with selected category
				await fetchPreview(model.ieeeAddress, {
					deviceCategory: model.category,
				});

				// Auto-populate device name from preview if not set
				if (preview.value && !model.name) {
					model.name = preview.value.suggestedDevice.name || model.name;
				}

				activeStep.value = 'three';
				reachedSteps.value.add('three');

				formResult.value = FormResult.NONE;

				return 'ok';
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesZigbee2mqttValidationException) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(t('devicesZigbee2mqttPlugin.messages.mapping.previewError'));
				}

				throw error;
			}
		} else if (step === 'three') {
			// Step 3 is just preview, no validation needed
			activeStep.value = 'four';
			reachedSteps.value.add('four');

			return 'ok';
		} else if (step === 'four') {
			// Step 4 is customization - validate that enabled exposes have channelCategory selected
			const form = formEl;
			if (!form) {
				throw new DevicesZigbee2mqttValidationException('Form reference not available');
			}

			form.clearValidate();

			formResult.value = FormResult.WORKING;

			try {
				// Validate that all enabled exposes have a channelCategory selected
				if (preview.value) {
					const invalidExposes: string[] = [];

					for (const expose of preview.value.exposes) {
						const override = exposeOverrides.value?.find((o) => o.exposeName === expose.exposeName);

						// Skip validation for explicitly skipped exposes
						if (override?.skip === true) {
							continue;
						}

						// Check if expose has a valid channelCategory
						const hasOverrideCategory = override?.channelCategory !== undefined;
						const suggestedCategory = expose.suggestedChannel?.category;
						const hasValidSuggestedCategory =
							suggestedCategory !== undefined && suggestedCategory !== DevicesModuleChannelCategory.generic;

						// Expose is enabled but missing a category
						const isEnabledWithoutCategory =
							override && !override.skip && !hasOverrideCategory && !hasValidSuggestedCategory;

						if (isEnabledWithoutCategory) {
							invalidExposes.push(expose.exposeName);
						}
					}

					if (invalidExposes.length > 0) {
						await form.validate().catch(() => {
							// Validation will fail, which is expected
						});

						const exposeList = invalidExposes.slice(0, 3).join(', ');
						const moreCount = invalidExposes.length > 3 ? ` (+${invalidExposes.length - 3} more)` : '';
						throw new DevicesZigbee2mqttValidationException(
							t('devicesZigbee2mqttPlugin.messages.mapping.missingChannelCategory', {
								exposes: exposeList + moreCount,
							})
						);
					}
				}

				const valid = await form.validate();

				if (!valid) {
					throw new DevicesZigbee2mqttValidationException('Form not valid');
				}

				// If user made changes, update preview before proceeding
				if (exposeOverrides.value && exposeOverrides.value.length > 0) {
					const overrides: IMappingPreviewRequest = {
						exposeOverrides: exposeOverrides.value,
						deviceCategory: model.category,
					};

					await fetchPreview(model.ieeeAddress, overrides);
				}

				// Proceed to next step
				activeStep.value = 'five';
				reachedSteps.value.add('five');

				formResult.value = FormResult.NONE;

				return 'ok';
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesZigbee2mqttValidationException) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(t('devicesZigbee2mqttPlugin.messages.mapping.previewError'));
				}

				throw error;
			}
		} else if (step === 'five') {
			// Check preview and readiness FIRST
			if (!preview.value) {
				throw new DevicesZigbee2mqttValidationException('Mapping preview is required for device adoption.');
			}

			if (preview.value.readyToAdopt !== true) {
				throw new DevicesZigbee2mqttValidationException(t('devicesZigbee2mqttPlugin.messages.mapping.notReadyToAdopt'));
			}

			const form = formEl;
			if (!form) {
				throw new DevicesZigbee2mqttValidationException('Form reference not available');
			}

			form.clearValidate();

			const valid = await form.validate();

			if (!valid) {
				throw new DevicesZigbee2mqttValidationException('Form not valid');
			}

			const parsedModel = Zigbee2mqttDeviceAddMultiStepFormSchema.safeParse(model);

			if (!parsedModel.success) {
				logger.error('Schema validation failed with:', parsedModel.error);

				throw new DevicesZigbee2mqttValidationException('Failed to validate create device model.');
			}

			formResult.value = FormResult.WORKING;

			const errorMessage = t('devicesZigbee2mqttPlugin.messages.devices.notCreated', { device: model.name });

			try {
				// Defensive check: Re-verify readyToAdopt before building adoption request
				if (!preview.value || preview.value.readyToAdopt !== true) {
					throw new DevicesZigbee2mqttValidationException(t('devicesZigbee2mqttPlugin.messages.mapping.notReadyToAdopt'));
				}

				// Build channels from preview exposes - GROUP by channel category
				const channelMap = new Map<
					DevicesModuleChannelCategory,
					{
						category: DevicesModuleChannelCategory;
						name: string;
						identifier: string;
						properties: {
							category: DevicesModuleChannelPropertyCategory;
							z2mProperty: string;
							dataType: DevicesModuleChannelPropertyDataType;
							permissions: DevicesModuleChannelPropertyPermissions[];
							unit: string | null;
							format: string[] | number[] | null;
						}[];
					}
				>();

				for (const expose of preview.value.exposes) {
					// Skip filtered exposes
					if (expose.status === 'skipped') {
						continue;
					}
					const override = exposeOverrides.value?.find((o) => o.exposeName === expose.exposeName);
					if (override?.skip) {
						continue;
					}
					if (!expose.suggestedChannel && !override?.channelCategory) {
						continue;
					}
					const finalChannelCategory = override?.channelCategory || expose.suggestedChannel?.category;
					if (!finalChannelCategory || finalChannelCategory === DevicesModuleChannelCategory.generic) {
						continue;
					}
					if (!expose.suggestedProperties || expose.suggestedProperties.length === 0) {
						continue;
					}

					// Get or create channel for this category
					let channel = channelMap.get(finalChannelCategory);
					if (!channel) {
						channel = {
							category: finalChannelCategory,
							name: expose.suggestedChannel?.name || finalChannelCategory,
							identifier: finalChannelCategory, // Use category as identifier
							properties: [],
						};
						channelMap.set(finalChannelCategory, channel);
					}

					// Add properties from this expose to the channel
					for (const prop of expose.suggestedProperties) {
						// Avoid duplicate properties (by category, not z2mProperty)
						// Multiple properties can share the same z2mProperty (e.g., hue and saturation both use "color")
						if (!channel.properties.find((p) => p.category === prop.category)) {
							channel.properties.push({
								category: prop.category,
								z2mProperty: prop.z2mProperty,
								dataType: prop.dataType,
								permissions: prop.permissions,
								unit: prop.unit ?? null,
								format: prop.format ?? null,
							});
						}
					}
				}

				const channels = Array.from(channelMap.values());

				const adoptRequest: IAdoptDeviceRequest = {
					ieeeAddress: model.ieeeAddress,
					name: model.name,
					category: model.category,
					description: model.description ?? null,
					enabled: model.enabled,
					channels,
				};

				// Adopt the device
				await adoptDevice(adoptRequest);

				formResult.value = FormResult.OK;

				timer = window.setTimeout(clear, 2000);

				flashMessage.success(
					t('devicesZigbee2mqttPlugin.messages.mapping.adoptionSuccess', {
						device: model.name,
					})
				);

				// Redirect to devices list
				router.push({
					name: DevicesRouteNames.DEVICES,
				});

				return 'added';
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (
					!(error instanceof DevicesZigbee2mqttApiException) &&
					!(error instanceof DevicesZigbee2mqttValidationException) &&
					!(error instanceof DevicesApiException)
				) {
					logger.error('Unexpected error during device adoption:', error);
					flashMessage.error(errorMessage);
				}

				throw error;
			}
		} else {
			throw new DevicesZigbee2mqttValidationException('Unknown step');
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
		(): string => model.ieeeAddress,
		(val: string, oldValue: string): void => {
			if (val !== oldValue) {
				clearPreview();
				exposeOverrides.value = [];
			}
		}
	);

	watch(
		(): IMappingPreviewResponse | null => preview.value,
		(val: IMappingPreviewResponse | null): void => {
			if (val) {
				// Auto-populate device name from preview if not set
				if (!model.name) {
					model.name = val.suggestedDevice.name || model.name;
				}
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
		devicesOptions,
		devicesOptionsLoading,
		exposeOverrides,
		model,
		formChanged,
		submitStep,
		clear,
		clearPreview,
		formResult,
	};
};
