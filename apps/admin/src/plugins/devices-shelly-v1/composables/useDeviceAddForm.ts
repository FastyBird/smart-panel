import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { tryOnMounted } from '@vueuse/core';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { deepClone, getErrorReason, getSchemaDefaults, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
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

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const deviceInfo = ref<IShellyV1DeviceInfo | null>(null);

	// Each check, and each change of the hostname or password, starts a new generation: a check that comes back for
	// an older one is not applied
	let checkGeneration = 0;

	// Test connection: reads the device at the hostname, with the password when it has one. A failure is returned to
	// the caller (the test result), not shown as a toast
	const checkDevice = async (): Promise<IShellyV1DeviceInfo> => {
		await formEl.value?.validateField(['hostname']);

		// A new check replaces the last result, whichever way it ends
		const generation = ++checkGeneration;

		deviceInfo.value = null;

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
				const info = transformDeviceInfoResponse(responseData.data);

				// Check if device is reachable
				if (!info.reachable) {
					throw new DevicesShellyV1ApiException(t('devicesShellyV1Plugin.messages.devices.notReachable'), 404);
				}

				// Check if authentication is valid
				if (info.authRequired && !info.authValid) {
					throw new DevicesShellyV1ApiException(t('devicesShellyV1Plugin.messages.devices.invalidPassword'), 401);
				}

				// Only set deviceInfo after validation passes to avoid triggering watchers on invalid data
				if (generation !== checkGeneration) {
					throw new DevicesShellyV1ApiException(errorMessage, 409);
				}

				deviceInfo.value = info;

				return deviceInfo.value;
			}

			let errorReason: string | null = errorMessage;

			if (error) {
				errorReason = getErrorReason<DevicesShellyV1PluginCreateDeviceInfoOperation>(error, errorReason);
			}

			throw new DevicesShellyV1ApiException(errorReason, response.status);
		} catch (error: unknown) {
			if (error instanceof DevicesShellyV1ApiException) {
				throw error;
			}

			throw new DevicesShellyV1ApiException(errorMessage, 500);
		}
	};

	// Save checks the device first when it was not tested, then adds it
	const submit = async (): Promise<'added'> => {
		formEl.value?.clearValidate();

		const valid = await formEl.value?.validate();

		if (!valid) throw new DevicesShellyV1ValidationException('Form not valid');

		if (deviceInfo.value === null) {
			formResult.value = FormResult.WORKING;

			try {
				await checkDevice();
			} catch (error: unknown) {
				const errorMessage = t('devicesShellyV1Plugin.messages.devices.notChecked', { device: model.name });

				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesShellyV1ApiException && (error.code === 422 || error.code === 404 || error.code === 401)) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(errorMessage);
				}

				throw error;
			}
		}

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
		(): [string, string | null | undefined] => [model.hostname, model.password],
		([hostname, password], [oldHostname, oldPassword]): void => {
			// A test holds only for the hostname and password it read the device with
			if (hostname !== oldHostname || password !== oldPassword) {
				checkGeneration++;
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
		deviceInfo,
		supportedDevices,
		model,
		formEl,
		formChanged,
		checkDevice,
		submit,
		clear,
		formResult,
	};
};
