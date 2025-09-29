<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-form-item
			:label="t('dashboardModule.fields.pages.id.title')"
			prop="id"
		>
			<el-input
				v-model="model.id"
				:placeholder="t('dashboardModule.fields.pages.id.placeholder')"
				name="id"
				required
				disabled
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.title.title')"
			prop="title"
		>
			<el-input
				v-model="model.title"
				:placeholder="t('dashboardModule.fields.pages.title.placeholder')"
				name="title"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.icon.title')"
			prop="icon"
		>
			<icon-picker
				v-model="model.icon"
				:placeholder="t('dashboardModule.fields.pages.icon.placeholder')"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.order.title')"
			prop="order"
		>
			<el-input-number
				v-model="model.order"
				:placeholder="t('dashboardModule.fields.pages.order.placeholder')"
				name="order"
			/>
		</el-form-item>

		<el-form-item
			:label="t('dashboardModule.fields.pages.showTopBar.title')"
			prop="showTopBar"
		>
			<el-switch
				v-model="model.showTopBar"
				name="showTopBar"
			/>
		</el-form-item>

		<display-profile-select
			v-model="model.display"
			:required="false"
		/>

		<el-divider />

		<el-row
			:gutter="10"
			class="mx-0!"
		>
			<el-col
				:span="12"
				class="px-0!"
			>
				<el-form-item
					:label="t('pagesTilesPlugin.fields.rows.title')"
					prop="rows"
				>
					<el-input-number
						v-model="model.rows"
						:placeholder="t('pagesTilesPlugin.fields.rows.placeholder')"
						:disabled="model.tileSize !== null"
						:min="1"
						:max="12"
						name="rows"
					/>
					<el-button
						plain
						class="ml-2 px-3!"
						@click="handleClearRows"
					>
						<template #icon>
							<icon icon="mdi:close" />
						</template>
					</el-button>
				</el-form-item>
			</el-col>

			<el-col
				:span="12"
				class="px-0!"
			>
				<el-form-item
					:label="t('pagesTilesPlugin.fields.cols.title')"
					prop="cols"
				>
					<el-input-number
						v-model="model.cols"
						:placeholder="t('pagesTilesPlugin.fields.cols.placeholder')"
						:disabled="model.tileSize !== null"
						:min="1"
						:max="12"
						name="cols"
					/>
					<el-button
						plain
						class="ml-2 px-3!"
						@click="handleClearCols"
					>
						<template #icon>
							<icon icon="mdi:close" />
						</template>
					</el-button>
				</el-form-item>
			</el-col>
		</el-row>

		<el-form-item
			:label="t('pagesTilesPlugin.fields.tileSize.title')"
			prop="tileSize"
		>
			<el-input-number
				v-model="model.tileSize"
				:placeholder="t('pagesTilesPlugin.fields.tileSize.placeholder')"
				:disabled="model.rows !== null || model.cols !== null"
				:min="40"
				:max="200"
				name="tileSize"
			/>
			<el-button
				plain
				class="ml-2 px-3!"
				@click="handleClearTileSize"
			>
				<template #icon>
					<icon icon="mdi:close" />
				</template>
			</el-button>
		</el-form-item>

		<el-alert
			:title="t('pagesTilesPlugin.headings.misc.tip')"
			:description="t('pagesTilesPlugin.texts.misc.gridLayoutTip')"
			:closable="false"
			show-icon
			type="success"
		>
			<template #icon>
				<icon icon="mdi:lightbulb-on" />
			</template>
		</el-alert>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCol, ElDivider, ElForm, ElFormItem, ElInput, ElInputNumber, ElRow, ElSwitch, type FormRules } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconPicker } from '../../../common';
import { FormResult, type FormResultType, type IPageAddFormProps, usePageAddForm } from '../../../modules/dashboard';
import { DisplayProfileSelect } from '../../../modules/system';
import { PAGES_TILES_TYPE } from '../pages-tiles.constants';
import type { ITilesPageAddForm } from '../schemas/pages.types';

defineOptions({
	name: 'TilesPageAddForm',
});

const props = withDefaults(defineProps<IPageAddFormProps>(), {
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

const { model, formEl, formChanged, submit, formResult } = usePageAddForm<ITilesPageAddForm>({ id: props.id, type: PAGES_TILES_TYPE });

const rules = reactive<FormRules<ITilesPageAddForm>>({
	title: [{ required: true, message: t('dashboardModule.fields.pages.title.validation.required'), trigger: 'change' }],
});

const handleClearRows = (): void => {
	model.rows = null;
};

const handleClearCols = (): void => {
	model.cols = null;
};

const handleClearTileSize = (): void => {
	model.tileSize = null;
};

watch(
	(): FormResultType => formResult.value,
	async (val: FormResultType): Promise<void> => {
		emit('update:remote-form-result', val);
	}
);

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
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
