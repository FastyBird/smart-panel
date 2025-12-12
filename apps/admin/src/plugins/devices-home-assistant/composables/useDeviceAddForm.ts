import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, getSchemaDefaults, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { FormResult, type FormResultType, type IDevice, devicesStoreKey } from '../../../modules/devices';
import { DevicesApiException, DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { router } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import { DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import { HomeAssistantDeviceAddFormSchema } from '../schemas/devices.schemas';
import type { IHomeAssistantDeviceAddForm } from '../schemas/devices.types';
import type { IMappingPreviewResponse, IAdoptDeviceRequest, IMappingPreviewRequest } from '../schemas/mapping-preview.types';
import { useDiscoveredDevicesOptions } from './useDiscoveredDevicesOptions';
import { useMappingPreview } from './useMappingPreview';
import { useDeviceAdoption } from './useDeviceAdoption';

import type { IUseDeviceAddForm } from './types';

interface IUseDeviceAddFormProps {
	id: IDevice['id'];
}

export const useDeviceAddForm = ({ id }: IUseDeviceAddFormProps): IUseDeviceAddForm<IHomeAssistantDeviceAddForm> => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const { preview, isLoading: isPreviewLoading, error: previewError, fetchPreview, clearPreview } = useMappingPreview();
	const { isAdopting, error: adoptionError, adoptDevice } = useDeviceAdoption();
	const { devicesOptions, areLoading: devicesOptionsLoading } = useDiscoveredDevicesOptions();

	const categoriesOptions = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(() => {
		// If we have a preview, use the suggested device category
		if (preview.value?.suggestedDevice) {
			const suggested = preview.value.suggestedDevice.category;
			const allCategories = Object.values(DevicesModuleDeviceCategory).map((value) => ({
				value,
				label: t(`devicesModule.categories.devices.${value}`),
			}));

			return allCategories;
		}

		return Object.values(DevicesModuleDeviceCategory).map((value) => ({
			value,
			label: t(`devicesModule.categories.devices.${value}`),
		}));
	});

	const model = reactive<IHomeAssistantDeviceAddForm>({
		...getSchemaDefaults(HomeAssistantDeviceAddFormSchema),
		id,
		type: DEVICES_HOME_ASSISTANT_TYPE,
		category: DevicesModuleDeviceCategory.generic,
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

	const activeStep = ref<'one' | 'two' | 'three' | 'four'>('one');

	const formChanged = ref<boolean>(false);

	const entityOverrides = ref<IMappingPreviewRequest['entityOverrides']>([]);

	const submitStep = async (step: 'one' | 'two' | 'three' | 'four'): Promise<'ok' | 'added'> => {
		if (step === 'one') {
			stepOneFormEl.value!.clearValidate();

			const valid = await stepOneFormEl.value!.validate();

			if (!valid) throw new DevicesHomeAssistantValidationException('Form not valid');

			formResult.value = FormResult.WORKING;

			try {
				// Fetch mapping preview
				await fetchPreview(model.haDeviceId);

				// Auto-populate device info from preview
				if (preview.value) {
					model.name = preview.value.haDevice.name || model.name;
					model.category = preview.value.suggestedDevice.category;
				}

				activeStep.value = 'two';

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
			// Step 2 is just preview, no validation needed
			// User can proceed to step 3 or go back
			activeStep.value = 'three';

			return 'ok';
		} else if (step === 'three') {
			// Step 3 is customization, optional
			// If user made changes, update preview
			if (entityOverrides.value && entityOverrides.value.length > 0) {
				formResult.value = FormResult.WORKING;

				try {
					const overrides: IMappingPreviewRequest = {
						entityOverrides: entityOverrides.value,
					};

					// Update preview with overrides
					if (preview.value) {
						overrides.deviceCategory = preview.value.suggestedDevice.category;
					}

					await fetchPreview(model.haDeviceId, overrides);

					// Update device category if changed
					if (preview.value) {
						model.category = preview.value.suggestedDevice.category;
					}

					formResult.value = FormResult.NONE;
				} catch (error: unknown) {
					formResult.value = FormResult.ERROR;

					timer = window.setTimeout(clear, 2000);

					flashMessage.error(t('devicesHomeAssistantPlugin.messages.mapping.previewError'));

					throw error;
				}
			}

			activeStep.value = 'four';

			return 'ok';
		} else if (step === 'four') {
			stepFourFormEl.value!.clearValidate();

			const valid = await stepFourFormEl.value!.validate();

			if (!valid) throw new DevicesHomeAssistantValidationException('Form not valid');

			const parsedModel = HomeAssistantDeviceAddFormSchema.safeParse(model);

			if (!parsedModel.success) {
				logger.error('Schema validation failed with:', parsedModel.error);

				throw new DevicesHomeAssistantValidationException('Failed to validate create device model.');
			}

			formResult.value = FormResult.WORKING;

			const errorMessage = t('devicesHomeAssistantPlugin.messages.devices.notCreated', { device: model.name });

			try {
				// Build adoption request from preview and model
				if (!preview.value) {
					throw new DevicesHomeAssistantValidationException('Mapping preview is required for device adoption.');
				}

				// Build channels from preview entities
				const channels = preview.value.entities
					.filter((entity) => entity.status !== 'skipped' && entity.suggestedChannel)
					.map((entity) => ({
						entityId: entity.entityId,
						category: entity.suggestedChannel!.category,
						name: entity.suggestedChannel!.name,
						properties: entity.suggestedProperties.map((prop) => ({
							category: prop.category,
							haAttribute: prop.haAttribute,
							dataType: prop.dataType,
							permissions: prop.permissions,
							unit: prop.unit ?? null,
							format: prop.format ?? null,
						})),
					}));

				const adoptRequest: IAdoptDeviceRequest = {
					haDeviceId: model.haDeviceId,
					name: model.name,
					category: model.category,
					channels,
				};

				// Adopt the device
				const adoptedDevice = await adoptDevice(adoptRequest);

				formResult.value = FormResult.OK;

				timer = window.setTimeout(clear, 2000);

				flashMessage.success(
					t('devicesHomeAssistantPlugin.messages.mapping.adoptionSuccess', {
						device: model.name,
					})
				);

				// Redirect to device edit page
				router.push({
					name: DevicesRouteNames.DEVICES_EDIT,
					params: {
						id: adoptedDevice.id,
					},
				});

				return 'added';
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesApiException && error.code === 422) {
					flashMessage.error(error.message);
				} else {
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
				// Auto-populate device name and category from preview
				model.name = val.haDevice.name || model.name;
				model.category = val.suggestedDevice.category;
			}
		}
	);

	return {
		categoriesOptions,
		activeStep,
		preview,
		isPreviewLoading,
		previewError,
		isAdopting,
		adoptionError,
		devicesOptions,
		devicesOptionsLoading,
		entityOverrides,
		model,
		stepOneFormEl,
		stepTwoFormEl,
		stepThreeFormEl,
		stepFourFormEl,
		formChanged,
		submitStep,
		clear,
		formResult,
	};
};
