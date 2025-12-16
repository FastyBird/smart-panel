import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { tryOnMounted } from '@vueuse/core';

import { deepClone, getErrorReason, getSchemaDefaults, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
import { DevicesApiException, FormResult, type FormResultType, type IDevice, devicesStoreKey } from '../../../modules/devices';
import type { DevicesShellyV1PluginCreateDeviceInfoOperation } from '../../../openapi.constants';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_SHELLY_V1_PLUGIN_PREFIX, DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { DevicesShellyV1ApiException, DevicesShellyV1ValidationException } from '../devices-shelly-v1.exceptions';
import { ShellyV1DeviceAddFormSchema } from '../schemas/devices.schemas';
import type { IShellyV1DeviceAddForm, IShellyV1DeviceInfo, IShellyV1SupportedDevice } from '../schemas/devices.types';
import { transformDeviceInfoRequest, transformDeviceInfoResponse } from '../utils/devices.transformers';

import type { IUseDeviceAddForm } from './types';
import { useSupportedDevices } from './useSupportedDevices';

interface IUseDeviceAddFormProps {
	id: IDevice['id'];
}

export const useDeviceAddForm = ({ id }: IUseDeviceAddFormProps): IUseDeviceAddForm => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { t } = useI18n();

	const backend = useBackend();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const { supportedDevices, fetchDevices: fetchSupportedDevices } = useSupportedDevices();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const deviceGroup = computed<IShellyV1SupportedDevice | null>((): IShellyV1SupportedDevice | null => {
		if (deviceInfo.value === null) {
			return null;
		}

		return supportedDevices.value.find((group) => group.models.includes(deviceInfo.value!.model.toUpperCase())) || null;
	});

	const categoriesOptions = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(
		(): { value: DevicesModuleDeviceCategory; label: string }[] => {
			return orderBy(deviceGroup.value?.categories || [], [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map(
				(value) => ({
					value,
					label: t(`devicesModule.categories.devices.${value}`),
				})
			);
		}
	);

	const model = reactive<IShellyV1DeviceAddForm>({
		...getSchemaDefaults(ShellyV1DeviceAddFormSchema),
		id,
		type: DEVICES_SHELLY_V1_TYPE,
		category: DevicesModuleDeviceCategory.generic,
		name: '',
		description: '',
		hostname: '',
		password: '',
		enabled: true,
	});

	const initialModel: Reactive<IShellyV1DeviceAddForm> = deepClone<Reactive<IShellyV1DeviceAddForm>>(toRaw(model));

	const stepOneFormEl = ref<FormInstance | undefined>(undefined);
	const stepTwoFormEl = ref<FormInstance | undefined>(undefined);

	const activeStep = ref<'one' | 'two'>('one');

	const formChanged = ref<boolean>(false);

	const deviceInfo = ref<IShellyV1DeviceInfo | null>(null);

	const submitStep = async (step: 'one' | 'two'): Promise<'ok' | 'added'> => {
		if (step === 'one') {
			stepOneFormEl.value!.clearValidate();

			const valid = await stepOneFormEl.value!.validate();

			if (!valid) throw new DevicesShellyV1ValidationException('Form not valid');

			formResult.value = FormResult.WORKING;

			const errorMessage = t('devicesShellyV1Plugin.messages.devices.notChecked', { device: model.name });

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_V1_PLUGIN_PREFIX}/devices/info`, {
					body: {
						data: transformDeviceInfoRequest({
							hostname: model.hostname,
							password: model.password,
						}),
					},
				});

				if (typeof responseData !== 'undefined') {
					deviceInfo.value = transformDeviceInfoResponse(responseData.data);

					// Check if device is reachable
					if (!deviceInfo.value.reachable) {
						throw new DevicesShellyV1ApiException(t('devicesShellyV1Plugin.messages.devices.notReachable'), 404);
					}

					// Check if authentication is valid
					if (deviceInfo.value.authRequired && !deviceInfo.value.authValid) {
						throw new DevicesShellyV1ApiException(t('devicesShellyV1Plugin.messages.devices.invalidPassword'), 401);
					}

					activeStep.value = 'two';

					formResult.value = FormResult.NONE;

					return 'ok';
				}

				let errorReason: string | null = 'Failed to check device.';

				if (error) {
					errorReason = getErrorReason<DevicesShellyV1PluginCreateDeviceInfoOperation>(error, errorReason);
				}

				throw new DevicesShellyV1ApiException(errorReason, response.status);
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesShellyV1ApiException && (error.code === 422 || error.code === 404 || error.code === 401)) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(errorMessage);
				}

				throw error;
			}
		} else if (step === 'two') {
			stepTwoFormEl.value!.clearValidate();

			const valid = await stepTwoFormEl.value!.validate();

			if (!valid) throw new DevicesShellyV1ValidationException('Form not valid');

			const parsedModel = ShellyV1DeviceAddFormSchema.safeParse(model);

			if (!parsedModel.success) {
				logger.error('Schema validation failed with:', parsedModel.error);

				throw new DevicesShellyV1ValidationException('Failed to validate create device model.');
			}

			formResult.value = FormResult.WORKING;

			const errorMessage = t('devicesShellyV1Plugin.messages.devices.notCreated', { device: model.name });

			try {
				await devicesStore.add({
					id,
					draft: false,
					data: {
						...parsedModel.data,
						type: DEVICES_SHELLY_V1_TYPE,
					},
				});
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

			formResult.value = FormResult.OK;

			timer = window.setTimeout(clear, 2000);

			flashMessage.success(
				t('devicesShellyV1Plugin.messages.devices.created', {
					device: model.name,
				})
			);

			return 'added';
		} else {
			throw new DevicesShellyV1ValidationException('Unknown step');
		}
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	tryOnMounted((): void => {
		fetchSupportedDevices().catch(() => {
			// Could be ignored
		});
	});

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	watch(
		(): string => model.hostname,
		(val: string, oldValue: string): void => {
			if (val !== oldValue) {
				deviceInfo.value = null;
			}
		}
	);

	watch(
		(): IShellyV1DeviceInfo | null => deviceInfo.value,
		(val: IShellyV1DeviceInfo | null): void => {
			model.identifier = val?.mac || null;
		}
	);

	return {
		categoriesOptions,
		activeStep,
		deviceInfo,
		supportedDevices,
		model,
		stepOneFormEl,
		stepTwoFormEl,
		formChanged,
		submitStep,
		clear,
		formResult,
	};
};
