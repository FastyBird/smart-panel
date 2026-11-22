import { type Reactive, computed, getCurrentScope, onScopeDispose, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { tryOnMounted } from '@vueuse/core';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { deepClone, getErrorReason, getSchemaDefaults, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
import { DevicesApiException, FormResult, type FormResultType, type IDevice, devicesStoreKey } from '../../../modules/devices';
import type { DevicesShellyNgPluginCreateDeviceInfoOperation } from '../../../openapi.constants';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_PLUGIN_PREFIX, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { DevicesShellyNgApiException, DevicesShellyNgValidationException } from '../devices-shelly-ng.exceptions';
import { ShellyNgDeviceAddFormSchema } from '../schemas/devices.schemas';
import type { IShellyNgDeviceAddForm, IShellyNgDeviceInfo, IShellyNgSupportedDevice } from '../schemas/devices.types';
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

	const { supportedDevices, loaded: supportedDevicesLoaded, fetchDevices: fetchSupportedDevices } = useSupportedDevices();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const deviceGroup = computed<IShellyNgSupportedDevice | null>((): IShellyNgSupportedDevice | null => {
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

	const model = reactive<IShellyNgDeviceAddForm>({
		...getSchemaDefaults(ShellyNgDeviceAddFormSchema),
		id,
		type: DEVICES_SHELLY_NG_TYPE,
		category: DevicesModuleDeviceCategory.generic,
		name: '',
		description: '',
		hostname: '',
		password: '',
		enabled: true,
	});

	const initialModel: Reactive<IShellyNgDeviceAddForm> = deepClone<Reactive<IShellyNgDeviceAddForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const deviceInfo = ref<IShellyNgDeviceInfo | null>(null);

	// Each change of the hostname or password starts a new generation: a check that comes back for an older one is
	// not applied
	let checkGeneration = 0;

	let pendingCheck: { key: string; promise: Promise<IShellyNgDeviceInfo> } | null = null;

	// Save goes on only while the form is shown: picking another plugin mid-check leaves this device unadded
	let disposed = false;

	if (getCurrentScope()) {
		onScopeDispose((): void => {
			disposed = true;
		});
	}

	// A device of this plugin that is in Smart Panel already, hidden ones included
	const findRegistered = (info: IShellyNgDeviceInfo): IDevice | undefined =>
		devicesStore.findAll().find((device) => device.identifier === info.id && device.type === DEVICES_SHELLY_NG_TYPE);

	// Test connection: reads the device at the hostname, with the password when it has one. A failure is returned to
	// the caller (the test result), not shown as a toast
	const checkDevice = async (): Promise<IShellyNgDeviceInfo> => {
		await formEl.value?.validateField(['hostname']);

		// A check already reading these credentials (Test connection, then Save) is the one to wait for
		const key = `${model.hostname}\u0000${model.password ?? ''}`;

		if (pendingCheck !== null && pendingCheck.key === key) {
			return pendingCheck.promise;
		}

		const promise = readDevice();

		pendingCheck = { key, promise };

		promise
			.finally((): void => {
				if (pendingCheck?.promise === promise) {
					pendingCheck = null;
				}
			})
			.catch((): void => {
				// The caller gets the rejection
			});

		return promise;
	};

	const readDevice = async (): Promise<IShellyNgDeviceInfo> => {
		// The result belongs to the credentials of this generation: changing them while it is read discards it
		const generation = checkGeneration;

		// A new check replaces the last result, whichever way it ends
		deviceInfo.value = null;

		const errorMessage = t('devicesShellyNgPlugin.messages.devices.notChecked', { device: model.name });

		try {
			const {
				data: responseData,
				error,
				response,
			} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/info`, {
				body: {
					data: transformDeviceInfoRequest({
						hostname: model.hostname,
						password: model.password,
					}),
				},
			});

			if (typeof responseData !== 'undefined') {
				const info = transformDeviceInfoResponse(responseData.data);

				if (generation !== checkGeneration) {
					throw new DevicesShellyNgApiException(errorMessage, 409);
				}

				deviceInfo.value = info;

				return deviceInfo.value;
			}

			let errorReason: string | null = errorMessage;

			if (error) {
				errorReason = getErrorReason<DevicesShellyNgPluginCreateDeviceInfoOperation>(error, errorReason);
			}

			throw new DevicesShellyNgApiException(errorReason, response.status);
		} catch (error: unknown) {
			if (error instanceof DevicesShellyNgApiException) {
				throw error;
			}

			throw new DevicesShellyNgApiException(errorMessage, 500);
		}
	};

	// Save checks the device first when it was not tested, then adds it
	const submit = async (): Promise<'added'> => {
		formEl.value?.clearValidate();

		const valid = await formEl.value?.validate();

		if (!valid) throw new DevicesShellyNgValidationException('Form not valid');

		if (deviceInfo.value === null) {
			formResult.value = FormResult.WORKING;

			try {
				await checkDevice();
			} catch (error: unknown) {
				const errorMessage = t('devicesShellyNgPlugin.messages.devices.notChecked', { device: model.name });

				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesShellyNgApiException && (error.code === 422 || error.code === 404)) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(errorMessage);
				}

				throw error;
			}
		}

		if (disposed) {
			formResult.value = FormResult.NONE;

			throw new DevicesShellyNgValidationException('The form was closed before the device was read.');
		}

		// The device is in Smart Panel already: the form opens it instead (see the add form), nothing is added
		if (deviceInfo.value !== null && findRegistered(deviceInfo.value) !== undefined) {
			formResult.value = FormResult.NONE;

			throw new DevicesShellyNgValidationException('The device is already registered.');
		}

		// The category comes from the supported device the read matched: without the list, or for a device it does
		// not list, nothing is added and Save can be tried again
		if (!supportedDevicesLoaded.value) {
			const generation = checkGeneration;

			await fetchSupportedDevices().catch((): void => {
				// Reported by the list itself
			});

			// While the list loaded, the form may have closed or the credentials changed: this Save is for neither
			if (disposed) {
				formResult.value = FormResult.NONE;

				throw new DevicesShellyNgValidationException('The form was closed before the device was read.');
			}

			if (generation !== checkGeneration) {
				formResult.value = FormResult.NONE;

				throw new DevicesShellyNgValidationException('The credentials changed while the device was read.');
			}
		}

		if (!supportedDevicesLoaded.value || deviceGroup.value === null) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (supportedDevicesLoaded.value) {
				flashMessage.error(t('devicesShellyNgPlugin.headings.device.notSupported'));
			}

			throw new DevicesShellyNgValidationException('The device has no supported category yet.');
		}

		if (!categoriesOptions.value.some((option) => option.value === model.category) && categoriesOptions.value[0]) {
			model.category = categoriesOptions.value[0].value;
		}

		const parsedModel = ShellyNgDeviceAddFormSchema.safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			// Save is ready again for the corrected form
			formResult.value = FormResult.NONE;

			throw new DevicesShellyNgValidationException('Failed to validate create device model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('devicesShellyNgPlugin.messages.devices.notCreated', { device: model.name });

		try {
			const { hostname, ...deviceData } = parsedModel.data;

			await devicesStore.add({
				id,
				draft: false,
				data: {
					...deviceData,
					wifiAddress: hostname,
					type: DEVICES_SHELLY_NG_TYPE,
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
			t('devicesShellyNgPlugin.messages.devices.created', {
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
				pendingCheck = null;
				deviceInfo.value = null;
			}
		}
	);

	watch(
		(): IShellyNgDeviceInfo | null => deviceInfo.value,
		(val: IShellyNgDeviceInfo | null): void => {
			model.identifier = val?.id || null;
		}
	);

	return {
		categoriesOptions,
		deviceInfo,
		supportedDevices,
		supportedDevicesLoaded,
		findRegistered,
		loadSupportedDevices: (): Promise<void> => fetchSupportedDevices(),
		model,
		formEl,
		formChanged,
		checkDevice,
		submit,
		clear,
		formResult,
	};
};
