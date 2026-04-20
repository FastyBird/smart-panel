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

import {
	ElAlert,
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

import { Icon } from '@iconify/vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { injectStoresManager, useBackend, useFlashMessage } from '../../../common';
import { type ISpace, SPACES_MODULE_PREFIX, spacesStoreKey } from '../../../modules/spaces';
import { useLocations } from '../../../modules/weather';
import type { components } from '../../../openapi';
import { SignageInfoPanelLayout } from '../spaces-signage-info-panel.constants';

// The PATCH endpoint's generated request body type resolves to the base
// `SpacesModuleUpdateSpace` schema, which does NOT include the subtype-
// specific signage fields (layout, show_clock, feed_url, …). The backend
// accepts the plugin's subtype DTO at runtime, but the generated client
// type is flat. We borrow the plugin's dedicated update schema so renames
// or removals on the backend surface as type errors here instead of
// silently shipping an empty body.
type SignageInfoPanelUpdateBody = components['schemas']['SpacesSignageInfoPanelPluginUpdateSignageInfoPanelSpace'];

import AnnouncementsSection from './announcements-section.vue';
import type { ISignageInfoPanelSpaceEditFormProps } from './signage-info-panel-space-edit-form.types';

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
const storesManager = injectStoresManager();
const spacesStore = storesManager.getStore(spacesStoreKey);
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

// Element Plus validation rules. Mirrors the core Room/Zone edit form's
// required-name rule so the signage form catches empty/whitespace-only names
// inline instead of bouncing off a backend validation exception.
const rules = computed<FormRules<SignageFormModel>>(() => ({
	name: [{ required: true, message: t('spacesModule.fields.spaces.name.validation.required'), trigger: 'blur' }],
	feedUrl: [{ type: 'url', message: t('spacesSignageInfoPanelPlugin.fields.feedUrl.validation.invalid'), trigger: 'blur' }],
}));

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

const applyServerPayload = (raw: Record<string, unknown>): void => {
	model.name = (raw.name as string | undefined) ?? props.space.name;
	model.description = (raw.description as string | null | undefined) ?? null;
	model.layout = ((raw.layout as SignageInfoPanelLayout | undefined) ?? SignageInfoPanelLayout.CLOCK_WEATHER_ANNOUNCEMENTS);
	model.showClock = (raw.show_clock as boolean | undefined) ?? true;
	model.showWeather = (raw.show_weather as boolean | undefined) ?? true;
	model.showAnnouncements = (raw.show_announcements as boolean | undefined) ?? true;
	model.showFeed = (raw.show_feed as boolean | undefined) ?? false;
	model.weatherLocationId = (raw.weather_location_id as string | null | undefined) ?? null;
	model.feedUrl = (raw.feed_url as string | null | undefined) ?? null;

	// Capture a plain snapshot (spread of a reactive proxy yields a fresh
	// non-reactive object) so `formChanged` keeps comparing against the
	// values the server returned — not the live `model` reference.
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
	} catch {
		// Swallow the error on purpose: `loadFailed` + the flash message
		// already communicate the failure to the UI, and `canSubmit` guards
		// the Save button so a stale load cannot be PATCHed back over the
		// server state. Re-throwing would turn an expected-and-handled
		// failure into an unhandled promise rejection for the
		// `Promise.all([...])` caller in onBeforeMount, and would also
		// short-circuit `fetchLocations()` even when it succeeded on its
		// own and the weather picker could have been populated.
		loadFailed.value = true;
		flashMessage.error(t('spacesModule.messages.notFound'));
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

	// Validate before PATCH. Without this an empty name (or malformed feed
	// URL) would round-trip to the backend and surface as a 4xx error toast
	// instead of an inline field message. Mirrors the core Room/Zone form's
	// validate-then-submit contract.
	if (formRef.value) {
		try {
			await formRef.value.validate();
		} catch {
			// Element Plus rejects with the list of invalid fields; the
			// <el-form-item> messages are already shown inline, so just abort.
			return;
		}
	}

	submitting.value = true;

	try {
		const payload: SignageInfoPanelUpdateBody = {
			name: model.name,
			description: model.description ?? undefined,
			// The local `SignageInfoPanelLayout` enum and the generated
			// `SpacesSignageInfoPanelPluginDataSignageInfoPanelSpaceLayout`
			// enum share string values but are nominally distinct; cast at
			// the boundary so the rest of the body stays type-checked.
			layout: model.layout as unknown as SignageInfoPanelUpdateBody['layout'],
			show_clock: model.showClock,
			show_weather: model.showWeather,
			show_announcements: model.showAnnouncements,
			show_feed: model.showFeed,
			weather_location_id: model.weatherLocationId ?? null,
			feed_url: model.feedUrl ?? null,
		};

		const { data, error } = await backend.client.PATCH(
			`/${MODULES_PREFIX}/${SPACES_MODULE_PREFIX}/spaces/{id}`,
			{
				params: { path: { id: props.space.id } },
				// The endpoint is typed with the base `SpacesModuleUpdateSpace`
				// DTO but the backend accepts the plugin subtype DTO. Cast at
				// the boundary so the subtype fields above stay type-checked.
				body: { data: payload as components['schemas']['SpacesModuleUpdateSpace'] },
			},
		);

		if (error || !data) {
			flashMessage.error(t('spacesModule.messages.editFailed', { space: props.space.name }));
			return;
		}

		// Re-seed both the form model and the baseline from the server
		// response so any server-side normalisation (e.g. `feed_url` trim)
		// is reflected in the form — otherwise `formChanged` would flag
		// the form as dirty immediately after a successful save.
		applyServerPayload(data.data as Record<string, unknown>);

		const updated: ISpace = {
			...props.space,
			name: model.name,
			description: model.description,
		};

		// Sync the Pinia spaces store so downstream views (list, detail) read
		// the new name/description immediately instead of the stale cached
		// values. The core `SpaceEditForm` goes through `spacesStore.edit()`
		// which writes both the backend and the cache atomically; we PATCH
		// directly (to send the subtype-specific fields that aren't on
		// ISpaceEditData) so we update the cache ourselves here.
		spacesStore.set({ id: props.space.id, data: { name: updated.name, description: updated.description } });

		// Parent `view-space-edit.vue::onSaved` shows the success toast — do
		// not double-flash from here. Keep the error path local because the
		// parent only hears about successful saves.
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
</script>
