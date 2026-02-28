<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('pagesCardsPlugin.fields.cards.title.title')"
			prop="title"
		>
			<el-input
				v-model="model.title"
				:placeholder="t('pagesCardsPlugin.fields.cards.title.placeholder')"
				name="title"
			/>
		</el-form-item>

		<el-form-item
			:label="t('pagesCardsPlugin.fields.cards.icon.title')"
			prop="icon"
		>
			<icon-picker
				v-model="model.icon"
				:placeholder="t('pagesCardsPlugin.fields.cards.icon.placeholder')"
			/>
		</el-form-item>

		<el-form-item
			:label="t('pagesCardsPlugin.fields.cards.order.title')"
			prop="order"
		>
			<el-input-number
				v-model="model.order"
				:placeholder="t('pagesCardsPlugin.fields.cards.order.placeholder')"
				name="order"
				:min="0"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElInputNumber, type FormInstance, type FormRules } from 'element-plus';

import { IconPicker } from '../../../common';
import { DashboardApiException, DashboardException, FormResult, type FormResultType } from '../../../modules/dashboard';
import { cardsStoreKey } from '../store/keys';
import { injectStoresManager } from '../../../common';

import type { ICardAddFormProps } from './card-add-form.types';

defineOptions({
	name: 'CardAddForm',
});

const props = withDefaults(defineProps<ICardAddFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const storesManager = injectStoresManager();
const cardsStore = storesManager.getStore(cardsStoreKey);

const formEl = ref<FormInstance>();
const formChanged = ref<boolean>(false);
const formResult = ref<FormResultType>(FormResult.NONE);

let timer: number;

const clear = (): void => {
	window.clearTimeout(timer);
	formResult.value = FormResult.NONE;
};

const model = reactive({
	title: '',
	icon: null as string | null,
	order: 0,
});

const rules = reactive<FormRules>({
	title: [{ required: true, message: t('pagesCardsPlugin.fields.cards.title.validation.required'), trigger: 'change' }],
});

const submit = async (): Promise<void> => {
	if (!formEl.value) return;

	await formEl.value.validate(async (valid: boolean): Promise<void> => {
		if (!valid) return;

		formResult.value = FormResult.WORKING;

		try {
			await cardsStore.add({
				id: props.id,
				pageId: props.page.id,
				draft: false,
				data: {
					title: model.title,
					icon: model.icon,
					order: model.order,
				},
			});

			formResult.value = FormResult.OK;
			timer = window.setTimeout(clear, 2000);
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;
			timer = window.setTimeout(clear, 2000);

			if (error instanceof DashboardApiException) {
				throw new DashboardException('Failed to create card.', error);
			}
		}
	});
};

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-form-submit', false);

			submit().catch(() => {
				// The form is not valid
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	(val: boolean): void => {
		emit('update:remote-form-reset', false);

		if (val) {
			if (!formEl.value) return;

			formEl.value.resetFields();
		}
	}
);

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

watch(
	model,
	(): void => {
		formChanged.value = true;
	},
	{ deep: true }
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
