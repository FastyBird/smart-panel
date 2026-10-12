import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { type IDevice } from '../../../modules/devices';
import { useDeviceEditFormSubmit } from '../../../modules/devices/composables/useDeviceEditFormSubmit';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DevicesReTerminalValidationException } from '../devices-reterminal.exceptions';
import { ReTerminalDeviceEditFormSchema } from '../schemas/devices.schemas';
import type { IReTerminalDeviceEditForm } from '../schemas/devices.types';

import type { IUseDeviceEditForm } from './types';

interface IUseDeviceEditFormProps {
	device: IDevice;
	messages?: { success?: string; error?: string };
}

const RETERMINAL_CATEGORIES = [DevicesModuleDeviceCategory.terminal];

export const useDeviceEditForm = ({ device, messages }: IUseDeviceEditFormProps): IUseDeviceEditForm => {
	const { t } = useI18n();

	const categoriesOptions = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(
		(): { value: DevicesModuleDeviceCategory; label: string }[] => {
			return orderBy(RETERMINAL_CATEGORIES, [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map((value) => ({
				value,
				label: t(`devicesModule.categories.devices.${value}`),
			}));
		}
	);

	const model = reactive<IReTerminalDeviceEditForm>(device as unknown as IReTerminalDeviceEditForm);

	const { formEl, formChanged, submit, clear, formResult } = useDeviceEditFormSubmit({
		device,
		model,
		messages,
		messagePrefix: 'devicesReTerminalPlugin',
		parseModel: () => ReTerminalDeviceEditFormSchema.safeParse(model),
		validationException: DevicesReTerminalValidationException,
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
