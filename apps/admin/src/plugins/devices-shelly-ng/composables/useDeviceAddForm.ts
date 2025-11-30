import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { tryOnMounted } from '@vueuse/core';

import { deepClone, getErrorReason, getSchemaDefaults, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
import { DevicesApiException, FormResult, type FormResultType, type IDevice, devicesStoreKey } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { type operations } from '../../../openapi';
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

	const { supportedDevices, fetchDevices: fetchSupportedDevices } = useSupportedDevices();

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

	const stepOneFormEl = ref<FormInstance | undefined>(undefined);
	const stepTwoFormEl = ref<FormInstance | undefined>(undefined);

	const activeStep = ref<'one' | 'two'>('one');

	const formChanged = ref<boolean>(false);

	const deviceInfo = ref<IShellyNgDeviceInfo | null>(null);

	const submitStep = async (step: 'one' | 'two'): Promise<'ok' | 'added'> => {
		if (step === 'one') {
			stepOneFormEl.value!.clearValidate();

			const valid = await stepOneFormEl.value!.validate();

			if (!valid) throw new DevicesShellyNgValidationException('Form not valid');

			formResult.value = FormResult.WORKING;

			const errorMessage = t('devicesShellyNgPlugin.messages.devices.notChecked', { device: model.name });

			try {
				const {
					data: responseData,
					error,
					response,
				} = await backend.client.POST(`/plugins/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/info`, {
					body: {
						data: transformDeviceInfoRequest({
							hostname: model.hostname,
							password: model.password,
						}),
					},
				});

				if (typeof responseData !== 'undefined') {
					deviceInfo.value = transformDeviceInfoResponse(responseData.data);

					activeStep.value = 'two';

					formResult.value = FormResult.NONE;

					return 'ok';
				}

				let errorReason: string | null = 'Failed to check device.';

				if (error) {
					errorReason = getErrorReason<operations['create-devices-shelly-ng-plugin-device-info']>(error, errorReason);
				}

				throw new DevicesShellyNgApiException(errorReason, response.status);
			} catch (error: unknown) {
				formResult.value = FormResult.ERROR;

				timer = window.setTimeout(clear, 2000);

				if (error instanceof DevicesShellyNgApiException && (error.code === 422 || error.code === 404)) {
					flashMessage.error(error.message);
				} else {
					flashMessage.error(errorMessage);
				}

				throw error;
			}
		} else if (step === 'two') {
			stepTwoFormEl.value!.clearValidate();

			const valid = await stepTwoFormEl.value!.validate();

			if (!valid) throw new DevicesShellyNgValidationException('Form not valid');

			const parsedModel = ShellyNgDeviceAddFormSchema.safeParse(model);

			if (!parsedModel.success) {
				logger.error('Schema validation failed with:', parsedModel.error);

				throw new DevicesShellyNgValidationException('Failed to validate create device model.');
			}

			formResult.value = FormResult.WORKING;

			const errorMessage = t('devicesShellyNgPlugin.messages.devices.notCreated', { device: model.name });

			try {
				await devicesStore.add({
					id,
					draft: false,
					data: {
						...parsedModel.data,
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
		} else {
			throw new DevicesShellyNgValidationException('Unknown step');
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
		(): IShellyNgDeviceInfo | null => deviceInfo.value,
		(val: IShellyNgDeviceInfo | null): void => {
			model.identifier = val?.id || null;
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
