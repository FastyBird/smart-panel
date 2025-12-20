import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { DevicesApiException, DevicesValidationException, FormResult, type FormResultType, type IDevice, devicesStoreKey } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DevicesWledValidationException } from '../devices-wled.exceptions';
import { WledDeviceEditFormSchema } from '../schemas/devices.schemas';
import type { IWledDeviceEditForm } from '../schemas/devices.types';

import type { IUseDeviceEditForm } from './types';

interface IUseDeviceEditFormProps {
	device: IDevice;
	messages?: { success?: string; error?: string };
}

// WLED LED controllers typically fall into these categories
const WLED_CATEGORIES = [
	DevicesModuleDeviceCategory.lighting,
];

export const useDeviceEditForm = ({ device, messages }: IUseDeviceEditFormProps): IUseDeviceEditForm => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const categoriesOptions = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(
		(): { value: DevicesModuleDeviceCategory; label: string }[] => {
			return orderBy(WLED_CATEGORIES, [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map(
				(value) => ({
					value,
					label: t(`devicesModule.categories.devices.${value}`),
				})
			);
		}
	);

	const model = reactive<IWledDeviceEditForm>(device as unknown as IWledDeviceEditForm);

	let initialModel: Reactive<IWledDeviceEditForm> = deepClone<Reactive<IWledDeviceEditForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = device.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: device.draft
					? t('devicesWledPlugin.messages.devices.notCreated', { device: device.name })
					: t('devicesWledPlugin.messages.devices.notEdited', { device: device.name });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		const parsedModel = WledDeviceEditFormSchema.safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new DevicesWledValidationException('Failed to validate edit device model.');
		}

		try {
			await devicesStore.edit({
				id: device.id,
				data: {
					...parsedModel.data,
					type: device.type,
				},
			});

			if (device.draft) {
				await devicesStore.save({
					id: device.id,
				});
			}
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

		if (isDraft) {
			flashMessage.success(
				t(messages && messages.success ? messages.success : 'devicesWledPlugin.messages.devices.created', {
					device: device.name,
				})
			);

			return 'added';
		}

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'devicesWledPlugin.messages.devices.edited', {
				device: device.name,
			})
		);

		formChanged.value = false;

		initialModel = deepClone<Reactive<IWledDeviceEditForm>>(toRaw(model));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
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
