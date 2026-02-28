<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('pagesCardsPlugin.fields.cards.id.title')"
			prop="id"
		>
			<el-input
				v-model="model.id"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>

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

		<el-row :gutter="10">
			<el-col :span="12">
				<el-form-item
					:label="t('pagesCardsPlugin.fields.cards.rows.title')"
					prop="rows"
				>
					<el-input-number
						v-model="model.rows"
						:placeholder="t('pagesCardsPlugin.fields.cards.rows.placeholder')"
						:min="1"
						:max="12"
						name="rows"
					/>
					<el-button
						plain
						class="ml-2 px-3!"
						@click="model.rows = null"
					>
						<template #icon>
							<icon icon="mdi:close" />
						</template>
					</el-button>
				</el-form-item>
			</el-col>

			<el-col :span="12">
				<el-form-item
					:label="t('pagesCardsPlugin.fields.cards.cols.title')"
					prop="cols"
				>
					<el-input-number
						v-model="model.cols"
						:placeholder="t('pagesCardsPlugin.fields.cards.cols.placeholder')"
						:min="1"
						:max="12"
						name="cols"
					/>
					<el-button
						plain
						class="ml-2 px-3!"
						@click="model.cols = null"
					>
						<template #icon>
							<icon icon="mdi:close" />
						</template>
					</el-button>
				</el-form-item>
			</el-col>
		</el-row>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCol, ElForm, ElFormItem, ElInput, ElInputNumber, ElRow, type FormInstance, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconPicker, injectStoresManager } from '../../../common';
import { DashboardApiException, DashboardException, FormResult, type FormResultType } from '../../../modules/dashboard';
import { cardsStoreKey } from '../store/keys';

import type { ICardEditFormProps } from './card-edit-form.types';

defineOptions({
	name: 'CardEditForm',
});

const props = withDefaults(defineProps<ICardEditFormProps>(), {
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
	id: props.card.id,
	title: props.card.title,
	icon: props.card.icon,
	order: props.card.order,
	rows: props.card.rows ?? null,
	cols: props.card.cols ?? null,
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
			await cardsStore.edit({
				id: props.card.id,
				pageId: props.page.id,
				data: {
					title: model.title,
					icon: model.icon,
					order: model.order,
					rows: model.rows,
					cols: model.cols,
				},
			});

			formResult.value = FormResult.OK;
			timer = window.setTimeout(clear, 2000);
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;
			timer = window.setTimeout(clear, 2000);

			if (error instanceof DashboardApiException) {
				throw new DashboardException('Failed to update card.', error);
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
