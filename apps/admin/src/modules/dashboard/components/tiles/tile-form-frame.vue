<template>
	<!-- eslint-disable vue/no-mutating-props -- the form owns its reactive model; the frame edits the shared fields in place -->
	<!-- Host frame of a tile form (spec section 7): Position and size first, the plugin's sections, Identifiers last.
	     It sits inside the form's own el-form, so the form's rules and validation reach these fields -->
	<plugin-form-section
		v-if="props.withPosition || props.withSize"
		:title="t('dashboardModule.sections.placement')"
		data-test-id="tile-form-placement"
	>
		<div
			v-if="props.withPosition"
			class="grid grid-cols-2 gap-x-4"
		>
			<el-form-item
				:label="t('dashboardModule.fields.tiles.row.title')"
				prop="row"
			>
				<el-input-number
					v-model="props.model.row"
					:placeholder="t('dashboardModule.fields.tiles.row.placeholder')"
					name="row"
				/>
			</el-form-item>
			<el-form-item
				:label="t('dashboardModule.fields.tiles.col.title')"
				prop="col"
			>
				<el-input-number
					v-model="props.model.col"
					:placeholder="t('dashboardModule.fields.tiles.col.placeholder')"
					name="col"
				/>
			</el-form-item>
		</div>

		<div
			v-if="props.withSize"
			class="grid grid-cols-2 gap-x-4"
		>
			<el-form-item
				:label="t('dashboardModule.fields.tiles.rowSpan.title')"
				prop="rowSpan"
			>
				<el-input-number
					v-model="props.model.rowSpan"
					:placeholder="t('dashboardModule.fields.tiles.rowSpan.placeholder')"
					name="rowSpan"
				/>
			</el-form-item>
			<el-form-item
				:label="t('dashboardModule.fields.tiles.colSpan.title')"
				prop="colSpan"
			>
				<el-input-number
					v-model="props.model.colSpan"
					:placeholder="t('dashboardModule.fields.tiles.colSpan.placeholder')"
					name="colSpan"
				/>
			</el-form-item>
		</div>
	</plugin-form-section>

	<!-- The plugin's own sections -->
	<slot />

	<plugin-form-section
		:title="t('dashboardModule.sections.identifiers')"
		data-test-id="tile-form-identifiers"
	>
		<el-form-item
			:label="t('dashboardModule.fields.tiles.id.title')"
			prop="id"
		>
			<el-input
				v-model="props.model.id"
				:placeholder="t('dashboardModule.fields.tiles.id.placeholder')"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>
	</plugin-form-section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElInput, ElInputNumber } from 'element-plus';

import { PluginFormSection } from '../../../../common';

import type { ITileFormFrameProps } from './tile-form-frame.types';

defineOptions({
	name: 'TileFormFrame',
});

const props = withDefaults(defineProps<ITileFormFrameProps>(), {
	withPosition: true,
	withSize: true,
});

const { t } = useI18n();
</script>
