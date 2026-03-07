<template>
	<el-form
		ref="formEl"
		:model="model"
		:rules="rules"
		label-position="top"
		status-icon
	>
		<el-alert
			type="info"
			:title="t('buddyDiscordPlugin.headings.aboutDiscordSettings')"
			:description="t('buddyDiscordPlugin.texts.aboutDiscordSettings')"
			:closable="false"
		/>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.enabled.title')"
			prop="enabled"
			label-position="left"
			class="mt-3"
		>
			<el-switch
				v-model="model.enabled"
				name="enabled"
			/>
		</el-form-item>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.botToken.title')"
			prop="botToken"
		>
			<el-input
				v-model="model.botToken"
				:placeholder="t('buddyDiscordPlugin.fields.config.botToken.placeholder')"
				name="botToken"
				type="password"
				show-password
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyDiscordPlugin.fields.config.botToken.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.guildId.title')"
			prop="guildId"
		>
			<el-input
				v-model="model.guildId"
				:placeholder="t('buddyDiscordPlugin.fields.config.guildId.placeholder')"
				name="guildId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyDiscordPlugin.fields.config.guildId.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.generalChannelId.title')"
			prop="generalChannelId"
		>
			<el-input
				v-model="model.generalChannelId"
				:placeholder="t('buddyDiscordPlugin.fields.config.generalChannelId.placeholder')"
				name="generalChannelId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyDiscordPlugin.fields.config.generalChannelId.description') }}
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.spaceChannelMappings.title')"
			prop="spaceChannelMappings"
		>
			<div class="w-full">
				<div
					v-for="(mapping, index) in mappings"
					:key="index"
					class="flex items-center gap-2 mb-2"
				>
					<el-select
						v-model="mapping.spaceId"
						:placeholder="t('buddyDiscordPlugin.fields.config.spaceChannelMappings.selectSpace')"
						filterable
						class="flex-1"
					>
						<el-option
							v-for="space in getAvailableSpaces(index)"
							:key="space.id"
							:label="space.name"
							:value="space.id"
						/>
					</el-select>
					<el-input
						v-model="mapping.channelId"
						:placeholder="t('buddyDiscordPlugin.fields.config.spaceChannelMappings.channelPlaceholder')"
						class="flex-1"
					/>
					<el-button
						type="danger"
						plain
						@click="removeMapping(index)"
					>
						<template #icon>
							<icon icon="mdi:trash" />
						</template>
					</el-button>
				</div>
				<el-button
					type="primary"
					plain
					size="small"
					@click="addMapping"
				>
					{{ t('buddyDiscordPlugin.fields.config.spaceChannelMappings.add') }}
				</el-button>
				<div class="text-xs text-gray-500 mt-1">
					{{ t('buddyDiscordPlugin.fields.config.spaceChannelMappings.description') }}
				</div>
			</div>
		</el-form-item>

		<el-form-item
			:label="t('buddyDiscordPlugin.fields.config.allowedRoleId.title')"
			prop="allowedRoleId"
		>
			<el-input
				v-model="model.allowedRoleId"
				:placeholder="t('buddyDiscordPlugin.fields.config.allowedRoleId.placeholder')"
				name="allowedRoleId"
			/>
			<div class="text-xs text-gray-500 mt-1">
				{{ t('buddyDiscordPlugin.fields.config.allowedRoleId.description') }}
			</div>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';
import { ElAlert, ElButton, ElForm, ElFormItem, ElInput, ElOption, ElSelect, ElSwitch, type FormRules } from 'element-plus';

import { FormResult, type FormResultType, Layout, useConfigPluginEditForm } from '../../../modules/config';
import { useSpaces } from '../../../modules/spaces';
import type { IDiscordConfigEditForm } from '../schemas/config.types';

import type { IDiscordConfigFormProps } from './discord-config-form.types';

defineOptions({
	name: 'DiscordConfigForm',
});

const props = withDefaults(defineProps<IDiscordConfigFormProps>(), {
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
	remoteFormChanged: false,
	layout: Layout.DEFAULT,
});

const emit = defineEmits<{
	(e: 'update:remote-form-submit', remoteFormSubmit: boolean): void;
	(e: 'update:remote-form-result', remoteFormResult: FormResultType): void;
	(e: 'update:remote-form-reset', remoteFormReset: boolean): void;
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();

const { formEl, model, formChanged, submit, formResult } = useConfigPluginEditForm<IDiscordConfigEditForm>({
	config: props.config,
	messages: {
		success: t('buddyDiscordPlugin.messages.config.edited'),
		error: t('buddyDiscordPlugin.messages.config.notEdited'),
	},
});

const { spaces, fetchSpaces } = useSpaces();

interface ISpaceChannelMapping {
	spaceId: string;
	channelId: string;
}

const mappings = reactive<ISpaceChannelMapping[]>([]);

const parseMappings = (): void => {
	const entries: ISpaceChannelMapping[] = [];

	try {
		const parsed = JSON.parse(model.spaceChannelMappings || '{}') as Record<string, string>;

		for (const [spaceId, channelId] of Object.entries(parsed)) {
			entries.push({ spaceId, channelId });
		}
	} catch {
		// Invalid JSON, start with empty mappings
	}

	mappings.splice(0, mappings.length, ...entries);
};

const syncToModel = (): void => {
	const obj: Record<string, string> = {};

	for (const m of mappings) {
		if (m.spaceId && m.channelId) {
			obj[m.spaceId] = m.channelId;
		}
	}

	model.spaceChannelMappings = Object.keys(obj).length > 0 ? JSON.stringify(obj) : null;
};

const getAvailableSpaces = (currentIndex: number) => {
	const usedSpaceIds = mappings.filter((_, i) => i !== currentIndex).map((m) => m.spaceId).filter(Boolean);

	return spaces.value.filter((space) => !usedSpaceIds.includes(space.id));
};

const addMapping = (): void => {
	mappings.push({ spaceId: '', channelId: '' });
};

const removeMapping = (index: number): void => {
	mappings.splice(index, 1);
	syncToModel();
};

parseMappings();
fetchSpaces();

watch(mappings, syncToModel, { deep: true });

const rules = reactive<FormRules<IDiscordConfigEditForm>>({});

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
			parseMappings();
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
