<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-collapse v-model="activeCollapses">
			<!-- 1. General Section -->
			<el-collapse-item name="general">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:information" />
						</el-icon>
						<span class="font-medium">{{ t('displaysModule.edit.sections.general.title') }}</span>
					</div>
				</template>

				<div class="px-2">
					<el-form-item
						:label="t('displaysModule.fields.displays.id.title')"
						:prop="['id']"
					>
						<el-input
							v-model="model.id"
							:placeholder="t('displaysModule.fields.displays.id.placeholder')"
							name="id"
							readonly
							disabled
						/>
					</el-form-item>

					<el-form-item
						:label="t('displaysModule.fields.displays.name.title')"
						:prop="['name']"
					>
						<el-input
							v-model="model.name"
							:placeholder="t('displaysModule.fields.displays.name.placeholder')"
							name="name"
						/>
					</el-form-item>

					<el-form-item
						:label="t('displaysModule.fields.displays.role.title')"
						:prop="['role']"
					>
						<el-select
							v-model="model.role"
							name="role"
							@change="onRoleChange"
						>
							<el-option
								value="room"
								:label="t('displaysModule.fields.displays.role.options.room')"
							/>
							<el-option
								value="master"
								:label="t('displaysModule.fields.displays.role.options.master')"
							/>
							<el-option
								value="entry"
								:label="t('displaysModule.fields.displays.role.options.entry')"
							/>
						</el-select>
						<div class="text-gray-500 text-sm mt-1">
							{{ t('displaysModule.fields.displays.role.description') }}
						</div>
					</el-form-item>

					<!-- Room Assignment (only for role=room) -->
					<el-form-item
						v-if="model.role === 'room'"
						:label="t('displaysModule.fields.displays.roomId.title')"
						:prop="['roomId']"
					>
						<el-select
							v-model="model.roomId"
							:placeholder="t('displaysModule.fields.displays.roomId.placeholder')"
							name="roomId"
							clearable
							filterable
						>
							<el-option
								v-for="room in roomSpaces"
								:key="room.id"
								:value="room.id"
								:label="room.name"
							>
								<span class="flex items-center gap-2">
									<el-icon v-if="room.icon">
										<icon :icon="room.icon" />
									</el-icon>
									{{ room.name }}
								</span>
							</el-option>
						</el-select>
						<div class="text-gray-500 text-sm mt-1">
							{{ t('displaysModule.fields.displays.roomId.description') }}
						</div>
					</el-form-item>
				</div>
			</el-collapse-item>

			<!-- 2. Home Page Section -->
			<el-collapse-item name="homePage">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:home" />
						</el-icon>
						<span class="font-medium">{{ t('displaysModule.edit.sections.homePage.title') }}</span>
					</div>
				</template>

				<div class="px-2">
					<el-form-item
						:label="t('displaysModule.fields.displays.homeMode.title')"
						:prop="['homeMode']"
					>
						<el-select
							v-model="model.homeMode"
							name="homeMode"
							@change="onHomeModeChange"
						>
							<el-option
								value="auto_space"
								:label="t('displaysModule.fields.displays.homeMode.options.autoSpace')"
							/>
							<el-option
								value="explicit"
								:label="t('displaysModule.fields.displays.homeMode.options.explicit')"
							/>
						</el-select>
						<div class="text-gray-500 text-sm mt-1">
							{{ t('displaysModule.fields.displays.homeMode.description') }}
						</div>
					</el-form-item>

					<el-form-item
						v-if="model.homeMode === 'explicit'"
						:label="t('displaysModule.fields.displays.homePageId.title')"
						:prop="['homePageId']"
					>
						<el-select
							v-model="model.homePageId"
							:placeholder="t('displaysModule.fields.displays.homePageId.placeholder')"
							name="homePageId"
							clearable
						>
							<el-option
								v-for="page in availablePages"
								:key="page.id"
								:value="page.id"
								:label="page.title"
							/>
						</el-select>
						<div class="text-gray-500 text-sm mt-1">
							{{ t('displaysModule.fields.displays.homePageId.description') }}
						</div>
					</el-form-item>

					<!-- Helper text for auto mode when role=room -->
					<el-alert
						v-if="model.homeMode === 'auto_space' && model.role === 'room'"
						type="info"
						:closable="false"
						show-icon
					>
						<template #title>
							<span v-html="t('displaysModule.edit.sections.homePage.autoRoomHint')" />
						</template>
					</el-alert>
				</div>
			</el-collapse-item>

			<!-- 3. Appearance Section -->
			<el-collapse-item name="appearance">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:palette" />
						</el-icon>
						<span class="font-medium">{{ t('displaysModule.edit.sections.appearance.title') }}</span>
					</div>
				</template>

				<div class="px-2">
					<el-form-item
						:label="t('displaysModule.fields.displays.brightness.title')"
						:prop="['brightness']"
					>
						<el-slider
							v-model="model.brightness"
							:min="0"
							:max="100"
							show-input
						/>
					</el-form-item>

					<el-form-item
						:label="t('displaysModule.fields.displays.darkMode.title')"
						:prop="['darkMode']"
						label-position="left"
					>
						<el-switch
							v-model="model.darkMode"
							name="darkMode"
						/>
					</el-form-item>

					<el-form-item
						:label="t('displaysModule.fields.displays.screenSaver.title')"
						:prop="['screenSaver']"
						label-position="left"
					>
						<el-switch
							v-model="model.screenSaver"
							name="screenSaver"
						/>
					</el-form-item>

					<el-form-item
						:label="t('displaysModule.fields.displays.screenLockDuration.title')"
						:prop="['screenLockDuration']"
					>
						<el-input-number
							v-model="model.screenLockDuration"
							:min="0"
							:max="3600"
						/>
						<span class="ml-2 text-gray-500">{{ t('displaysModule.fields.displays.screenLockDuration.unit') }}</span>
					</el-form-item>
				</div>
			</el-collapse-item>

			<!-- 4. Layout Section (Advanced) -->
			<el-collapse-item name="layout">
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:view-grid" />
						</el-icon>
						<span class="font-medium">{{ t('displaysModule.edit.sections.layout.title') }}</span>
						<el-tag size="small" type="info">{{ t('displaysModule.edit.sections.layout.badge') }}</el-tag>
					</div>
				</template>

				<div class="px-2">
					<el-alert
						:title="t('displaysModule.edit.sections.layout.description')"
						type="info"
						:closable="false"
						show-icon
						class="mb-4!"
					/>
					<div class="grid grid-cols-3 gap-4">
						<el-form-item
							:label="t('displaysModule.fields.displays.unitSize.title')"
							:prop="['unitSize']"
						>
							<el-input-number
								v-model="model.unitSize"
								:min="1"
								name="unitSize"
								class="w-full"
							/>
							<span class="text-gray-500 text-xs ml-1">{{ t('displaysModule.fields.displays.unitSize.unit') }}</span>
						</el-form-item>

						<el-form-item
							:label="t('displaysModule.fields.displays.rows.title')"
							:prop="['rows']"
						>
							<el-input-number
								v-model="model.rows"
								:min="1"
								name="rows"
								class="w-full"
							/>
						</el-form-item>

						<el-form-item
							:label="t('displaysModule.fields.displays.cols.title')"
							:prop="['cols']"
						>
							<el-input-number
								v-model="model.cols"
								:min="1"
								name="cols"
								class="w-full"
							/>
						</el-form-item>
					</div>
				</div>
			</el-collapse-item>

			<!-- 5. Audio Section (Advanced) -->
			<el-collapse-item
				v-if="display.audioOutputSupported || display.audioInputSupported"
				name="audio"
			>
				<template #title>
					<div class="flex items-center gap-2">
						<el-icon :size="20">
							<icon icon="mdi:volume-high" />
						</el-icon>
						<span class="font-medium">{{ t('displaysModule.edit.sections.audio.title') }}</span>
						<el-tag size="small" type="info">{{ t('displaysModule.edit.sections.audio.badge') }}</el-tag>
					</div>
				</template>

				<div class="px-2">
					<!-- Speaker Settings -->
					<template v-if="display.audioOutputSupported">
						<el-form-item
							:label="t('displaysModule.fields.displays.speaker.title')"
							:prop="['speaker']"
							label-position="left"
						>
							<el-switch
								v-model="model.speaker"
								name="speaker"
							/>
						</el-form-item>

						<el-form-item
							:label="t('displaysModule.fields.displays.speakerVolume.title')"
							:prop="['speakerVolume']"
						>
							<el-slider
								v-model="model.speakerVolume"
								:min="0"
								:max="100"
								:disabled="!model.speaker"
								show-input
							/>
						</el-form-item>
					</template>

					<!-- Microphone Settings -->
					<template v-if="display.audioInputSupported">
						<el-divider v-if="display.audioOutputSupported" />

						<el-form-item
							:label="t('displaysModule.fields.displays.microphone.title')"
							:prop="['microphone']"
							label-position="left"
						>
							<el-switch
								v-model="model.microphone"
								name="microphone"
							/>
						</el-form-item>

						<el-form-item
							:label="t('displaysModule.fields.displays.microphoneVolume.title')"
							:prop="['microphoneVolume']"
						>
							<el-slider
								v-model="model.microphoneVolume"
								:min="0"
								:max="100"
								:disabled="!model.microphone"
								show-input
							/>
						</el-form-item>
					</template>
				</div>
			</el-collapse-item>
		</el-collapse>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElCollapse,
	ElCollapseItem,
	ElDivider,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElInputNumber,
	ElOption,
	ElSelect,
	ElSlider,
	ElSwitch,
	ElTag,
	type FormRules,
} from 'element-plus';
import { Icon } from '@iconify/vue';

import { usePages } from '../../dashboard/composables/composables';
import { useSpaces } from '../../spaces/composables';
import { useDisplayEditForm } from '../composables/useDisplayEditForm';
import { FormResult, type FormResultType } from '../displays.constants';
import type { IDisplayEditForm } from '../composables/types';

import type { IDisplayEditFormProps } from './display-edit-form.types';

defineOptions({
	name: 'DisplayEditForm',
});

const props = withDefaults(defineProps<IDisplayEditFormProps>(), {
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

const { pages, fetchPages } = usePages();
const { roomSpaces, fetchSpaces, firstLoadFinished } = useSpaces();

// Filter pages to only show those visible to the current display
// Pages with null/undefined/empty displays array are visible to all displays
// Pages with specific display IDs are only visible to those displays
const availablePages = computed(() => {
	return pages.value.filter((page) => {
		// No displays restriction - visible to all
		if (!page.displays || page.displays.length === 0) {
			return true;
		}
		// Check if current display is in the allowed list
		return page.displays.includes(props.display.id);
	});
});

// Fetch spaces and pages when component mounts
// The stores handle deduplication, so it's safe to always call fetch
onMounted(async () => {
	try {
		await Promise.all([
			firstLoadFinished.value ? Promise.resolve() : fetchSpaces(),
			fetchPages().catch(() => {
				// Pages fetch may fail if already fetching, that's OK
			}),
		]);
	} catch {
		// Ignore errors - stores will handle retries
	}
});

const { model, formEl, formChanged, submit, formResult } = useDisplayEditForm({ display: props.display });

// Collapse state - only General open by default
const activeCollapses = ref<string[]>(['general']);

// Handle role change - clear roomId if switching away from room role
const onRoleChange = (newRole: string): void => {
	if (newRole !== 'room') {
		model.roomId = null;
	}
};

// Handle homeMode change - clear homePageId if switching away from explicit
const onHomeModeChange = (newMode: string): void => {
	if (newMode !== 'explicit') {
		model.homePageId = null;
	}
};

const rules = computed<FormRules<IDisplayEditForm>>(() => ({
	name: [{ max: 100, message: t('displaysModule.fields.displays.name.validation.maxLength'), trigger: 'blur' }],
	roomId: [
		{
			required: model.role === 'room',
			message: t('displaysModule.fields.displays.roomId.validation.required'),
			trigger: 'blur',
		},
	],
	unitSize: [{ type: 'number', min: 1, message: t('displaysModule.fields.displays.unitSize.validation.min'), trigger: 'blur' }],
	rows: [{ type: 'number', min: 1, message: t('displaysModule.fields.displays.rows.validation.min'), trigger: 'blur' }],
	cols: [{ type: 'number', min: 1, message: t('displaysModule.fields.displays.cols.validation.min'), trigger: 'blur' }],
	brightness: [{ type: 'number', min: 0, max: 100, message: t('displaysModule.fields.displays.brightness.validation.range'), trigger: 'blur' }],
	screenLockDuration: [{ type: 'number', min: 0, message: t('displaysModule.fields.displays.screenLockDuration.validation.min'), trigger: 'blur' }],
	homePageId: [
		{
			required: model.homeMode === 'explicit',
			message: t('displaysModule.fields.displays.homePageId.validation.required'),
			trigger: 'blur',
		},
	],
	speakerVolume: [{ type: 'number', min: 0, max: 100, message: t('displaysModule.fields.displays.speakerVolume.validation.range'), trigger: 'blur' }],
	microphoneVolume: [
		{ type: 'number', min: 0, max: 100, message: t('displaysModule.fields.displays.microphoneVolume.validation.range'), trigger: 'blur' },
	],
}));

watch(
	(): FormResultType => formResult.value,
	(val: FormResultType): void => {
		emit('update:remote-form-result', val);
	}
);

watch(
	(): boolean => props.remoteFormSubmit ?? false,
	(val: boolean): void => {
		if (val) {
			emit('update:remote-form-submit', false);

			submit().catch(() => {
				// The form is not valid
			});
		}
	}
);

watch(
	(): boolean => props.remoteFormReset ?? false,
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
