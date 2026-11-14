<template>
	<el-dialog
		:model-value="props.visible"
		:title="selected ? templateName(selected) : t('automations.templates.headings.pick')"
		:close-on-click-modal="!submitting"
		:close-on-press-escape="!submitting"
		:show-close="!submitting"
		width="min(640px, 95vw)"
		class="automation-template-dialog"
		data-test-id="automation-template-dialog"
		@update:model-value="onVisible"
		@open="onOpen"
	>
		<template v-if="selected === null">
			<el-text
				tag="p"
				class="mb-4!"
			>
				{{ t('automations.templates.texts.pick') }}
			</el-text>

			<div
				v-if="loading && templates.length === 0"
				v-loading="true"
				class="h-[120px]"
				data-test-id="templates-loading"
			/>

			<el-result
				v-else-if="loadFailed && templates.length === 0"
				icon="error"
				:title="t('automations.templates.texts.loadFailed')"
				data-test-id="templates-load-failed"
			>
				<template #extra>
					<el-button
						type="primary"
						@click="fetchTemplates"
					>
						{{ t('automations.buttons.retry.title') }}
					</el-button>
				</template>
			</el-result>

			<el-empty
				v-else-if="templates.length === 0"
				:description="t('automations.templates.texts.empty')"
				data-test-id="templates-empty"
			/>

			<div
				v-else
				class="flex flex-col gap-2"
			>
				<button
					v-for="template in templates"
					:key="template.id"
					type="button"
					class="automation-template-dialog__item flex flex-row items-start gap-3 p-3 text-left rounded-md b-1 b-solid cursor-pointer"
					:data-test-template="template.id"
					@click="onPick(template)"
				>
					<icon
						:icon="template.icon ?? AUTOMATION_DEFAULT_ICON"
						class="text-2xl flex-none mt-0.5"
					/>
					<span class="flex flex-col gap-1">
						<span class="font-500">{{ templateName(template) }}</span>
						<el-text
							size="small"
							type="info"
						>
							{{ templateDescription(template) }}
						</el-text>
					</span>
				</button>
			</div>
		</template>

		<el-form
			v-else
			label-position="top"
			:disabled="submitting"
			data-test-id="automation-template-form"
			@submit.prevent
		>
			<el-text
				tag="p"
				class="mb-4!"
			>
				{{ templateDescription(selected) }}
			</el-text>

			<template
				v-for="parameter in selected.parameters"
				:key="parameter.id"
			>
				<div
					v-if="parameter.type === AutomationTemplateParameterType.property"
					class="mb-2"
					:data-test-parameter="parameter.id"
				>
					<el-text
						tag="div"
						class="font-500 mb-1"
					>
						{{ parameterLabel(selected, parameter) }}
					</el-text>
					<el-text
						v-if="parameterDescription(selected, parameter)"
						tag="div"
						size="small"
						type="info"
						class="mb-2"
					>
						{{ parameterDescription(selected, parameter) }}
					</el-text>

					<automation-node-target
						:device-id="propertyAnswer(parameter.id).device_id"
						:channel-id="propertyAnswer(parameter.id).channel_id"
						:property-id="propertyAnswer(parameter.id).property_id"
						:access="parameter.access ?? undefined"
						:property-filter="propertyFilter(parameter)"
						:prefix="`${parameter.id}.`"
						:errors="errorsAt(parameter.id)"
						@change="(patch) => setPropertyAnswer(parameter.id, patch)"
					/>
				</div>

				<el-form-item
					v-else
					:label="parameterLabel(selected, parameter)"
					:error="errorsAt(parameter.id).join(' ') || undefined"
					:data-test-parameter="parameter.id"
					required
				>
					<automation-duration-input
						v-if="parameter.type === AutomationTemplateParameterType.duration"
						:model-value="numberAnswer(parameter.id)"
						:min="parameter.min ?? 1"
						:max="parameter.max ?? DURATION_MAX_SECONDS"
						:name="parameter.id"
						@update:model-value="(value: number | undefined): void => setAnswer(parameter.id, value)"
					/>

					<div
						v-else-if="parameter.type === AutomationTemplateParameterType.number"
						class="flex flex-row items-center gap-2 w-full"
					>
						<el-input-number
							:model-value="numberAnswer(parameter.id)"
							:min="parameter.min ?? undefined"
							:max="parameter.max ?? undefined"
							:step="parameter.step ?? 1"
							:name="parameter.id"
							:value-on-clear="null"
							controls-position="right"
							class="grow-1"
							@update:model-value="(value: number | null | undefined): void => setAnswer(parameter.id, value ?? undefined)"
						/>
						<el-text v-if="parameter.unit">{{ parameter.unit }}</el-text>
					</div>

					<el-input
						v-else
						:model-value="textAnswer(parameter.id)"
						:maxlength="parameter.maxLength ?? undefined"
						:name="parameter.id"
						show-word-limit
						@update:model-value="(value: string): void => setAnswer(parameter.id, value)"
					/>

					<el-text
						v-if="parameterDescription(selected, parameter)"
						size="small"
						type="info"
					>
						{{ parameterDescription(selected, parameter) }}
					</el-text>
				</el-form-item>
			</template>

			<el-alert
				v-for="(error, index) in otherErrors"
				:key="index"
				type="error"
				:title="error"
				:closable="false"
				class="mb-2!"
			/>

			<el-alert
				type="info"
				:closable="false"
				show-icon
			>
				{{ t('automations.templates.texts.hint') }}
			</el-alert>
		</el-form>

		<template #footer>
			<el-button
				v-if="selected !== null"
				:disabled="submitting"
				link
				class="mr-2"
				data-test-id="template-back"
				@click="onBack"
			>
				{{ t('automations.templates.buttons.back.title') }}
			</el-button>

			<el-button
				:disabled="submitting"
				data-test-id="template-cancel"
				@click="onVisible(false)"
			>
				{{ t('automations.buttons.cancel.title') }}
			</el-button>

			<el-button
				v-if="selected !== null"
				type="primary"
				:loading="submitting"
				:disabled="!complete || submitting"
				data-test-id="template-continue"
				@click="onContinue"
			>
				{{ t('automations.templates.buttons.continue.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
/*
 * "New from template": pick a template, answer its questions, and the backend generates the flow of a new
 * automation from them. The flow is not saved here: it is handed to the add form, by the id the new automation
 * will get, and the editor opens with it once the automation is created.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog, ElEmpty, ElForm, ElFormItem, ElInput, ElInputNumber, ElResult, ElText, vLoading } from 'element-plus';
import { v4 as uuid } from 'uuid';

import { Icon } from '@iconify/vue';

import type { IChannelProperty } from '../../../devices/store/channels.properties.store.types';
import { AUTOMATION_DEFAULT_ICON, AutomationTemplateParameterType } from '../../automations.constants';
import { stashAutomationDraft } from '../../automations.drafts';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { useAutomationTemplateForm } from '../../composables/useAutomationTemplateForm';
import { useAutomationTemplates } from '../../composables/useAutomationTemplates';
import type { IAutomationTemplate, IAutomationTemplateParameter } from '../../store/templates.store.types';
import AutomationDurationInput from '../nodes/automation-duration-input.vue';
import AutomationNodeTarget from '../nodes/automation-node-target.vue';

import type { IAutomationTemplateDialogProps } from './automation-template-dialog.types';

defineOptions({
	name: 'AutomationTemplateDialog',
});

// The longest "for" duration a device trigger takes (7 days), for a question that names no bound
const DURATION_MAX_SECONDS = 7 * 24 * 60 * 60;

const props = defineProps<IAutomationTemplateDialogProps>();

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
	// The id the new automation is to be created with; its draft is stashed under it
	(e: 'generated', id: string): void;
}>();

const { t } = useI18n();

const { templates, loading, loadFailed, fetchTemplates, templateName, templateDescription, parameterLabel, parameterDescription } =
	useAutomationTemplates();

const lookups = useAutomationNodeLookups();

const selected = ref<IAutomationTemplate | null>(null);

const { submitting, complete, otherErrors, setAnswer, setPropertyAnswer, propertyAnswer, errorsAt, submit, answers } = useAutomationTemplateForm({
	template: selected,
});

const numberAnswer = (id: string): number | undefined => {
	const value = answers.value[id];

	return typeof value === 'number' ? value : undefined;
};

const textAnswer = (id: string): string => {
	const value = answers.value[id];

	return typeof value === 'string' ? value : '';
};

// The backend checks the same again; here it keeps the pickers to what the question takes
const propertyFilter =
	(parameter: IAutomationTemplateParameter) =>
	(property: IChannelProperty): boolean => {
		if (parameter.propertyCategories.length > 0 && !parameter.propertyCategories.includes(property.category)) {
			return false;
		}

		if (parameter.dataTypes.length > 0 && !parameter.dataTypes.includes(property.dataType)) {
			return false;
		}

		if (parameter.channelCategories.length > 0) {
			const channel = lookups.channel(property.channel);

			return channel !== null && parameter.channelCategories.includes(channel.category);
		}

		return true;
	};

// Read on every open: the backend may have restarted with other templates. The list held stays on screen
// meanwhile, and the store joins a read already on its way.
const onOpen = (): void => {
	fetchTemplates().catch((): void => {
		// The dialog says so and offers to try again
	});
};

const onPick = (template: IAutomationTemplate): void => {
	selected.value = template;
};

const onBack = (): void => {
	selected.value = null;
};

const onVisible = (visible: boolean): void => {
	if (!visible && submitting.value) {
		return;
	}

	emit('update:visible', visible);

	if (!visible) {
		selected.value = null;
	}
};

const onContinue = async (): Promise<void> => {
	const draft = await submit();

	if (draft === null) {
		return;
	}

	const id = uuid();

	stashAutomationDraft(id, draft);

	selected.value = null;

	emit('update:visible', false);
	emit('generated', id);
};
</script>

<style scoped>
.automation-template-dialog__item {
	background-color: transparent;
	border-color: var(--el-border-color);
	color: inherit;
	font: inherit;
}

.automation-template-dialog__item:hover,
.automation-template-dialog__item:focus-visible {
	border-color: var(--el-color-primary);
	background-color: var(--el-color-primary-light-9);
}
</style>
