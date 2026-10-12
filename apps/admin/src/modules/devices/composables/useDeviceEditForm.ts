import { reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DevicesValidationException } from '../devices.exceptions';
import { DeviceEditFormSchema } from '../schemas/devices.schemas';
import type { IDeviceEditForm } from '../schemas/devices.types';
import type { IDevice } from '../store/devices.store.types';

import type { IUseDeviceEditForm } from './types';
import { useDeviceEditFormSubmit } from './useDeviceEditFormSubmit';
import { useDevicesPlugin } from './useDevicesPlugin';

interface IUseDeviceEditFormProps {
	device: IDevice;
	messages?: { success?: string; error?: string };
}

export const useDeviceEditForm = <TForm extends IDeviceEditForm = IDeviceEditForm>({
	device,
	messages,
}: IUseDeviceEditFormProps): IUseDeviceEditForm<TForm> => {
	const { element } = useDevicesPlugin({ type: device.type });

	const { t } = useI18n();

	const categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[] = Object.values(DevicesModuleDeviceCategory).map((value) => ({
		value,
		label: t(`devicesModule.categories.devices.${value}`),
	}));

	const model = reactive<TForm>(device as unknown as TForm);

	const { formEl, formChanged, submit, clear, formResult } = useDeviceEditFormSubmit({
		device,
		model,
		messages,
		messagePrefix: 'devicesModule',
		parseModel: () => (element.value?.schemas?.deviceEditFormSchema || DeviceEditFormSchema).safeParse(model),
		validationException: DevicesValidationException,
	});

	return {
		categoriesOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
