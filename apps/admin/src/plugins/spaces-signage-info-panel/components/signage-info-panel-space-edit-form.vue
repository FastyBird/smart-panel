<template>
	<el-form
		ref="formRef"
		:model="model"
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
						<el-input v-model="model.name" />
					</el-form-item>

					<el-form-item
						:label="t('spacesModule.fields.spaces.description.title')"
						prop="description"
					>
						<el-input
							v-model="model.description"
							type="textarea"
							:rows="3"
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

			<el-collapse-item name="announcements">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:message-text-outline" />
						</el-icon>
						<span class="font-medium">
							{{ t('spacesSignageInfoPanelPlugin.announcements.heading') }}
						</span>
					</div>
				</template>

				<div class="px-2">
					<announcements-section :space-id="props.space.id" />
				</div>
			</el-collapse-item>
		</el-collapse>

		<el-alert
			v-if="loadFailed"
			type="error"
			:closable="false"
			:title="t('spacesModule.messages.notFound')"
			show-icon
			class="!my-2"
		/>

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
				:disabled="!canSubmit"
				@click="onSubmit"
			>
				{{ t('spacesModule.buttons.save.title') }}
			</el-button>
		</div>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCollapse, ElCollapseItem, ElForm, ElFormItem, ElIcon, ElInput, ElOption, ElSelect, ElSwitch, type FormInstance } from 'element-plus';

import { Icon } from '@iconify/vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { useBackend, useFlashMessage } from '../../../common';
import { type ISpace, SPACES_MODULE_PREFIX } from '../../../modules/spaces';
import { useLocations } from '../../../modules/weather';
import { SignageInfoPanelLayout } from '../spaces-signage-info-panel.constants';

import AnnouncementsSection from './announcements-section.vue';
import {
	type ISignageInfoPanelSpaceEditFormProps,
	signageInfoPanelSpaceEditFormEmits,
} from './signage-info-panel-space-edit-form.types';

const props = withDefaults(defineProps<ISignageInfoPanelSpaceEditFormProps>(), {
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
const { locations: weatherLocations, fetchLocations } = useLocations();

const layoutOptions = Object.values(SignageInfoPanelLayout);

const activeCollapses = ref<string[]>(['general', 'sections', 'announcements']);

// The subtype fields arrive as snake_case on the REST response but the core
// spaces store's ISpace currently omits them (it only declares the generic
// polymorphic columns). Fetch the fresh space directly from the backend so
// the form is populated with the signage subtype fields.
interface SignageFormModel {
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

const model = reactive<SignageFormModel>({
	name: props.space.name,
	description: props.space.description,
	layout: SignageInfoPanelLayout.CLOCK_WEATHER_ANNOUNCEMENTS,
	showClock: true,
	showWeather: true,
	showAnnouncements: true,
	showFeed: false,
	weatherLocationId: null,
	feedUrl: null,
});

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const baseline = ref<SignageFormModel | null>(null);
const loadFailed = ref(false);

// `baseline` stays null until `fetchSpace` succeeds. Submitting before then
// would PATCH the server with the form's hardcoded defaults — silently
// overwriting any saved configuration the fetch never managed to load — so
// the Save button (and the whole `submit()` call exposed via defineExpose)
// must wait until we know what the server actually has.
const canSubmit = computed<boolean>(() => baseline.value !== null && !loadFailed.value);

const formChanged = computed<boolean>(() => {
	if (!baseline.value) return false;
	return Object.keys(model).some((key) => {
		const k = key as keyof SignageFormModel;
		return model[k] !== baseline.value![k];
	});
});

watch(formChanged, (changed) => {
	emit('update:remote-form-changed', changed);
});

const fetchSpace = async (): Promise<void> => {
	const { data, error } = await backend.client.GET(
		`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}`,
		{ params: { path: { id: props.space.id } } },
	);

	if (error || !data) return;

	const raw = data.data as Record<string, unknown>;
	model.name = (raw.name as string | undefined) ?? props.space.name;
	model.description = (raw.description as string | null | undefined) ?? null;
	model.layout = ((raw.layout as SignageInfoPanelLayout | undefined) ?? SignageInfoPanelLayout.CLOCK_WEATHER_ANNOUNCEMENTS);
	model.showClock = (raw.show_clock as boolean | undefined) ?? true;
	model.showWeather = (raw.show_weather as boolean | undefined) ?? true;
	model.showAnnouncements = (raw.show_announcements as boolean | undefined) ?? true;
	model.showFeed = (raw.show_feed as boolean | undefined) ?? false;
	model.weatherLocationId = (raw.weather_location_id as string | null | undefined) ?? null;
	model.feedUrl = (raw.feed_url as string | null | undefined) ?? null;

	baseline.value = { ...model };
};

const fetchSpace = async (): Promise<void> => {
	loadFailed.value = false;

	try {
		const { data, error } = await backend.client.GET(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}`,
			{ params: { path: { id: props.space.id } } },
		);

		if (error || !data) {
			loadFailed.value = true;
			flashMessage.error(t('spacesModule.messages.notFound'));
			return;
		}

		applyServerPayload(data.data as Record<string, unknown>);
	} catch (err) {
		loadFailed.value = true;
		flashMessage.error(t('spacesModule.messages.notFound'));
		throw err;
	}
};

const onSubmit = async (): Promise<void> => {
	if (submitting.value) return;
	// Refuse to PATCH until the initial fetch succeeded — otherwise we'd
	// overwrite the server's saved configuration with the form's hardcoded
	// defaults. The Save button is also disabled in this state, but
	// `defineExpose({ submit: onSubmit })` makes the parent able to invoke
	// us directly, so the runtime guard stays.
	if (!canSubmit.value) return;

	submitting.value = true;

	try {
		const { data, error } = await backend.client.PATCH(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}`,
			{
				params: { path: { id: props.space.id } },
				body: {
					data: {
						name: model.name,
						description: model.description ?? undefined,
						layout: model.layout,
						show_clock: model.showClock,
						show_weather: model.showWeather,
						show_announcements: model.showAnnouncements,
						show_feed: model.showFeed,
						weather_location_id: model.weatherLocationId ?? null,
						feed_url: model.feedUrl ?? null,
					} as unknown as Parameters<typeof backend.client.PATCH>[1] extends { body?: infer B } ? (B extends { data: infer D } ? D : never) : never,
				},
			},
		);

		if (error || !data) {
			flashMessage.error(t('spacesModule.messages.editFailed', { space: props.space.name }));
			return;
		}

		baseline.value = { ...model };

		const updated: ISpace = {
			...props.space,
			name: model.name,
			description: model.description,
		};

		flashMessage.success(t('spacesModule.messages.edited', { space: updated.name }));
		emit('saved', updated);
	} finally {
		submitting.value = false;
	}
};

const onCancel = (): void => {
	emit('cancel');
};

onBeforeMount(async () => {
	await Promise.all([fetchSpace(), fetchLocations()]);
});

defineExpose({
	submit: onSubmit,
});

// Keep emit declaration visible to the runtime emits contract.
void signageInfoPanelSpaceEditFormEmits;
</script>
