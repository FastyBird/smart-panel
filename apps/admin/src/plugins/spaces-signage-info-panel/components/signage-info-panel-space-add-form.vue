<template>
	<el-form
		ref="formRef"
		:model="model"
		:rules="rules"
		label-position="top"
		@submit.prevent="onSubmit"
	>
		<el-collapse v-model="activeCollapses">
			<el-collapse-item name="general">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:information-outline" />
						</el-icon>
						<span class="font-medium">{{ t('spacesModule.edit.sections.general.title') }}</span>
					</div>
				</template>

				<div class="px-2">
					<el-form-item
						:label="t('spacesModule.fields.spaces.name.title')"
						prop="name"
					>
						<el-input
							v-model="model.name"
							:placeholder="t('spacesModule.fields.spaces.name.placeholder')"
						/>
					</el-form-item>

					<el-form-item
						:label="t('spacesModule.fields.spaces.description.title')"
						prop="description"
					>
						<el-input
							v-model="model.description"
							type="textarea"
							:rows="3"
							:placeholder="t('spacesModule.fields.spaces.description.placeholder')"
						/>
					</el-form-item>

					<el-form-item
						:label="t('spacesSignageInfoPanelPlugin.fields.layout.label')"
						prop="layout"
					>
						<el-select v-model="model.layout">
							<el-option
								v-for="option in layoutOptions"
								:key="option"
								:label="t(`spacesSignageInfoPanelPlugin.fields.layout.options.${option}`)"
								:value="option"
							/>
						</el-select>
					</el-form-item>
				</div>
			</el-collapse-item>

			<el-collapse-item name="sections">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:view-grid-outline" />
						</el-icon>
						<span class="font-medium">
							{{ t('spacesSignageInfoPanelPlugin.fields.sections.title') }}
						</span>
					</div>
				</template>

				<div class="px-2">
					<p class="text-sm text-gray-500 mb-3">
						{{ t('spacesSignageInfoPanelPlugin.fields.sections.description') }}
					</p>

					<el-form-item :label="t('spacesSignageInfoPanelPlugin.fields.sections.showClock')">
						<el-switch v-model="model.showClock" />
					</el-form-item>

					<el-form-item :label="t('spacesSignageInfoPanelPlugin.fields.sections.showWeather')">
						<el-switch v-model="model.showWeather" />
					</el-form-item>

					<el-form-item
						v-if="model.showWeather"
						:label="t('spacesSignageInfoPanelPlugin.fields.weatherLocation.label')"
					>
						<el-select
							v-model="model.weatherLocationId"
							clearable
							:placeholder="t('spacesSignageInfoPanelPlugin.fields.weatherLocation.placeholder')"
						>
							<el-option
								v-for="location in weatherLocations"
								:key="location.id"
								:label="location.name"
								:value="location.id"
							/>
						</el-select>
					</el-form-item>

					<el-form-item :label="t('spacesSignageInfoPanelPlugin.fields.sections.showAnnouncements')">
						<el-switch v-model="model.showAnnouncements" />
					</el-form-item>

					<el-form-item :label="t('spacesSignageInfoPanelPlugin.fields.sections.showFeed')">
						<el-switch v-model="model.showFeed" />
					</el-form-item>

					<el-form-item
						v-if="model.showFeed"
						:label="t('spacesSignageInfoPanelPlugin.fields.feedUrl.label')"
					>
						<el-input
							v-model="model.feedUrl"
							:placeholder="t('spacesSignageInfoPanelPlugin.fields.feedUrl.placeholder')"
						/>
					</el-form-item>
				</div>
			</el-collapse-item>
		</el-collapse>

		<div
			v-if="!props.hideActions"
			class="flex flex-row gap-2 justify-end items-center mt-4"
		>
			<el-button @click="onCancel">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				type="primary"
				:loading="submitting"
				@click="onSubmit"
			>
				{{ t('spacesModule.buttons.save.title') }}
			</el-button>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { onBeforeMount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElOption,
	ElSelect,
	ElSwitch,
	type FormInstance,
	type FormRules,
} from 'element-plus';
import { isEqual } from 'lodash';
import { v4 as uuid } from 'uuid';

import { Icon } from '@iconify/vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { injectStoresManager, useBackend, useFlashMessage } from '../../../common';
import {
	type ApiSpace,
	type ISpace,
	SPACES_MODULE_PREFIX,
	SpaceType,
	spacesStoreKey,
	transformSpaceResponse,
} from '../../../modules/spaces';
import { useLocations } from '../../../modules/weather';
import type { components } from '../../../openapi';
import { SignageInfoPanelLayout } from '../spaces-signage-info-panel.constants';

import type { ISignageInfoPanelSpaceAddFormProps } from './signage-info-panel-space-add-form.types';

// The POST endpoint's generated request body type resolves to the base
// `SpacesModuleCreateSpace` schema, which does NOT include the subtype-
// specific signage fields (layout, show_clock, feed_url, …). The backend
// accepts the plugin's subtype DTO at runtime, but the generated client
// type is flat. We borrow the plugin's dedicated create schema so renames
// or removals on the backend surface as type errors here instead of
// silently shipping an empty body.
type SignageInfoPanelCreateBody = components['schemas']['SpacesSignageInfoPanelPluginCreateSignageInfoPanelSpace'];

// The parent view passes the picker-chosen type through as `props.type`. We
// only accept it to stay compatible with the generic `ISpaceAddFormProps`
// contract — this form always creates a SIGNAGE_INFO_PANEL space regardless
// of what the picker sent (the picker filters to signage types on its own).
const props = withDefaults(defineProps<ISignageInfoPanelSpaceAddFormProps>(), {
	hideActions: false,
});

const emit = defineEmits<{
	(e: 'saved', space: ISpace): void;
	(e: 'cancel'): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();
const backend = useBackend();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();
const spacesStore = storesManager.getStore(spacesStoreKey);
const { locations: weatherLocations, fetchLocations } = useLocations();

const layoutOptions = Object.values(SignageInfoPanelLayout);

const activeCollapses = ref<string[]>(['general', 'sections']);

interface SignageAddFormModel {
	name: string;
	description: string | null;
	layout: SignageInfoPanelLayout;
	showClock: boolean;
	showWeather: boolean;
	showAnnouncements: boolean;
	showFeed: boolean;
	weatherLocationId: string | null;
	feedUrl: string | null;
}

const initialModel: SignageAddFormModel = {
	name: '',
	description: null,
	layout: SignageInfoPanelLayout.CLOCK_WEATHER_ANNOUNCEMENTS,
	showClock: true,
	showWeather: true,
	showAnnouncements: true,
	showFeed: false,
	weatherLocationId: null,
	feedUrl: null,
};

const model = reactive<SignageAddFormModel>({ ...initialModel });

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);

const rules = ref<FormRules<SignageAddFormModel>>({
	name: [{ required: true, message: t('spacesModule.fields.spaces.name.validation.required'), trigger: 'blur' }],
	feedUrl: [{ type: 'url', message: t('spacesSignageInfoPanelPlugin.fields.feedUrl.validation.invalid'), trigger: 'blur' }],
});

// Emit `formChanged=true` when any field diverges from the initial snapshot so
// the parent view can prompt "Discard changes?" on close. `isEqual` handles
// both primitive and null comparisons without the noise of hand-coded checks.
watch(
	model,
	(): void => {
		emit('update:remote-form-changed', !isEqual({ ...model }, initialModel));
	},
);

const onSubmit = async (): Promise<void> => {
	if (submitting.value) return;

	if (formRef.value) {
		try {
			await formRef.value.validate();
		} catch {
			return;
		}
	}

	submitting.value = true;

	try {
		const id = uuid().toString();

		const payload: SignageInfoPanelCreateBody = {
			id,
			type: SpaceType.SIGNAGE_INFO_PANEL as unknown as SignageInfoPanelCreateBody['type'],
			name: model.name,
			description: model.description ?? null,
			layout: model.layout as unknown as SignageInfoPanelCreateBody['layout'],
			show_clock: model.showClock,
			show_weather: model.showWeather,
			show_announcements: model.showAnnouncements,
			show_feed: model.showFeed,
			weather_location_id: model.weatherLocationId ?? null,
			feed_url: model.feedUrl ?? null,
		};

		const { data, error } = await backend.client.POST(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces`,
			{
				// The endpoint is typed with the base `SpacesModuleCreateSpace`
				// DTO but the backend accepts the plugin subtype DTO. The
				// `type` enum is the only non-overlapping field (base is
				// room|zone|master|entry|signage_info_panel; subtype is just
				// signage_info_panel), so the generated types refuse a direct
				// cast. Go via `unknown` to document the intent — the subtype
				// fields stay type-checked via `SignageInfoPanelCreateBody`.
				body: {
					data: payload as unknown as components['schemas']['SpacesModuleCreateSpace'],
				},
			},
		);

		if (error || !data) {
			flashMessage.error(t('spacesModule.messages.notCreated', { space: model.name }));
			return;
		}

		// Inject the newly created space into the Pinia cache so list views
		// render it immediately instead of waiting for the SPACE_CREATED
		// WebSocket event to round-trip.
		const created: ISpace = transformSpaceResponse(data.data as ApiSpace);
		spacesStore.onEvent({ id: created.id, data: data.data as Record<string, unknown> });

		flashMessage.success(t('spacesModule.messages.created', { space: model.name }));

		emit('saved', created);
	} finally {
		submitting.value = false;
	}
};

const onCancel = (): void => {
	emit('cancel');
};

onBeforeMount(async () => {
	await fetchLocations();
});

defineExpose({
	submit: onSubmit,
});
</script>
