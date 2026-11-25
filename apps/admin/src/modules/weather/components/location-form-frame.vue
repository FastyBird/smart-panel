<template>
	<!-- eslint-disable vue/no-mutating-props -- the form owns its reactive model; the frame edits the shared fields in place -->
	<!-- Host frame of a location form (spec section 7): General first, the provider's section, Identifiers last.
	     It sits inside the form's own el-form, so the form's rules and validation reach these fields -->
	<plugin-form-section
		:title="t('weatherModule.sections.general')"
		data-test-id="location-form-general"
	>
		<el-form-item
			:label="t('weatherModule.fields.locations.name.title')"
			prop="name"
		>
			<el-input
				v-model="props.model.name"
				:placeholder="t('weatherModule.fields.locations.name.placeholder')"
				name="name"
			/>
			<div class="text-help mt-1">
				{{ t('weatherModule.fields.locations.name.description') }}
			</div>
		</el-form-item>
	</plugin-form-section>

	<!-- The provider's "<Provider> location" section -->
	<slot />

	<plugin-form-section
		v-if="props.showId"
		:title="t('weatherModule.sections.identifiers')"
		data-test-id="location-form-identifiers"
	>
		<el-form-item
			:label="t('weatherModule.fields.locations.id.title')"
			prop="id"
		>
			<el-input
				v-model="props.model.id"
				name="id"
				readonly
				disabled
			/>
		</el-form-item>
	</plugin-form-section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElFormItem, ElInput } from 'element-plus';

import { PluginFormSection } from '../../../common';

import type { ILocationFormFrameProps } from './location-form-frame.types';

defineOptions({
	name: 'LocationFormFrame',
});

const props = withDefaults(defineProps<ILocationFormFrameProps>(), {
	showId: false,
});

const { t } = useI18n();
</script>
