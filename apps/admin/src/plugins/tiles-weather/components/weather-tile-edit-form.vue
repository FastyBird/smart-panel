<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<tile-form-frame
			:model="model"
			:with-position="props.withPosition"
			:with-size="props.withSize"
		>
			<plugin-form-section :title="t('tilesWeatherPlugin.sections.weather')">
				<el-form-item
					:label="t('tilesWeatherPlugin.fields.locationId.title')"
					:prop="['locationId']"
				>
					<el-select
						v-model="model.locationId"
						:placeholder="t('tilesWeatherPlugin.fields.locationId.placeholder')"
						name="locationId"
						clearable
						:loading="locationsLoading"
					>
						<el-option
							v-for="location in locations"
							:key="location.id"
							:label="location.name"
							:value="location.id"
						/>
					</el-select>
				</el-form-item>

				<el-alert
					:description="t('tilesWeatherPlugin.fields.locationId.description')"
					:closable="false"
					show-icon
					type="info"
					class="mb-4"
				/>
			</plugin-form-section>
		</tile-form-frame>
	</el-form>
</template>

<script setup lang="ts">
import { onBeforeMount, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElForm, ElFormItem, ElOption, ElSelect, type FormRules } from 'element-plus';

import { PluginFormSection } from '../../../common';
import { FormResult, type FormResultType, TileFormFrame, useTileEditForm } from '../../../modules/dashboard';
import { useLocations } from '../../../modules/weather';
import type { IWeatherTileEditForm } from '../schemas/tiles.types';

import type { IWeatherTileEditFormProps } from './weather-tile-edit-form.types';

defineOptions({
	name: 'WeatherTileEditForm',
});

const props = withDefaults(defineProps<IWeatherTileEditFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	onlyDraft: false,
	withPosition: true,
	withSize: true,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { model, formEl, formChanged, submit, formResult } = useTileEditForm<IWeatherTileEditForm>({
	tile: props.tile,
	onlyDraft: props.onlyDraft,
});

const { locations, areLoading: locationsLoading, fetchLocations } = useLocations();

const rules = reactive<FormRules<IWeatherTileEditForm>>({
	row: [{ required: true, message: t('dashboardModule.fields.tiles.row.validation.required'), trigger: 'change' }],
	col: [{ required: true, message: t('dashboardModule.fields.tiles.col.validation.required'), trigger: 'change' }],
});

onBeforeMount(async (): Promise<void> => {
	await fetchLocations();
});

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
