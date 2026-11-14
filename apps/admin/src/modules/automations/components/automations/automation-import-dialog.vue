<template>
	<el-dialog
		:model-value="props.visible"
		:title="t('automations.transfer.headings.import')"
		:close-on-click-modal="!submitting"
		:close-on-press-escape="!submitting"
		:show-close="!submitting"
		width="min(720px, 95vw)"
		data-test-id="automation-import-dialog"
		@update:model-value="onVisible"
		@open="onOpen"
	>
		<template v-if="preparation === null">
			<el-text
				tag="p"
				class="mb-4!"
			>
				{{ t('automations.transfer.texts.pick') }}
			</el-text>

			<el-upload
				drag
				:auto-upload="false"
				:show-file-list="false"
				:disabled="submitting"
				accept=".yaml,.yml,application/yaml,text/yaml"
				class="mb-4"
				data-test-id="import-file"
				@change="onFile"
			>
				<icon
					icon="mdi:file-upload-outline"
					class="text-4xl"
				/>
				<div class="el-upload__text">{{ t('automations.transfer.texts.drop') }}</div>
			</el-upload>

			<el-input
				:model-value="yaml"
				type="textarea"
				:rows="10"
				:disabled="submitting"
				:placeholder="t('automations.transfer.fields.yaml.placeholder')"
				:aria-label="t('automations.transfer.fields.yaml.title')"
				class="automation-import-dialog__yaml"
				spellcheck="false"
				data-test-id="import-yaml"
				@update:model-value="setYaml"
			/>
		</template>

		<template v-else>
			<el-descriptions
				:column="1"
				border
				class="mb-4"
			>
				<el-descriptions-item :label="t('automations.fields.name')">
					<span data-test-id="import-name">{{ preparation.draft.name }}</span>
				</el-descriptions-item>
				<el-descriptions-item :label="t('automations.transfer.fields.nodes.title')">
					{{ preparation.draft.graph.nodes.length }}
				</el-descriptions-item>
			</el-descriptions>

			<el-alert
				v-if="missingReferences.length === 0"
				type="success"
				:title="t('automations.transfer.texts.allFound')"
				:closable="false"
				show-icon
				class="mb-4!"
				data-test-id="import-all-found"
			/>

			<template v-else>
				<el-text
					tag="p"
					class="mb-2!"
				>
					{{ t('automations.transfer.texts.missing', { count: missingReferences.length }, missingReferences.length) }}
				</el-text>

				<div
					v-for="reference in missingReferences"
					:key="referenceKey(reference)"
					class="automation-import-dialog__reference flex flex-col gap-2 p-3 mb-2 rounded-md b-1 b-solid"
					:data-test-reference="referenceKey(reference)"
				>
					<div class="flex flex-row flex-wrap items-baseline gap-2">
						<el-tag
							size="small"
							disable-transitions
						>
							{{ t(`automations.transfer.kinds.${reference.kind}`) }}
						</el-tag>
						<code class="text-xs break-all">{{ reference.id }}</code>
						<el-text
							size="small"
							type="info"
						>
							{{ usedBy(reference) }}
						</el-text>
					</div>

					<automation-node-target
						v-if="remappable(reference) && reference.kind === AutomationReferenceKind.property"
						:device-id="propertyTarget(reference).device_id"
						:channel-id="propertyTarget(reference).channel_id"
						:property-id="propertyTarget(reference).property_id"
						:prefix="`${referenceKey(reference)}.`"
						@change="(patch) => onPropertyTarget(reference, patch)"
					/>

					<el-select
						v-else-if="remappable(reference)"
						:model-value="mappingFor(reference) ?? undefined"
						:placeholder="t('automations.transfer.fields.mapping.placeholder')"
						:name="referenceKey(reference)"
						:aria-label="t('automations.transfer.fields.mapping.title', { kind: t(`automations.transfer.kinds.${reference.kind}`) })"
						filterable
						clearable
						@update:model-value="(to: string | undefined): void => setMapping(reference, to ?? null)"
					>
						<el-option
							v-for="option in optionsFor(reference)"
							:key="option.value"
							:label="option.label"
							:value="option.value"
						/>
					</el-select>

					<el-text
						v-else
						size="small"
						type="info"
					>
						{{ t('automations.transfer.texts.notRemappable') }}
					</el-text>
				</div>

				<el-alert
					type="info"
					:closable="false"
					show-icon
					class="mb-2!"
				>
					{{ t('automations.transfer.texts.unresolved') }}
				</el-alert>
			</template>

			<div
				v-if="warnings.length > 0"
				data-test-id="import-warnings"
			>
				<el-alert
					type="warning"
					:title="t('automations.transfer.texts.warnings', { count: warnings.length }, warnings.length)"
					:closable="false"
					show-icon
					class="mb-2!"
				>
					<ul class="my-0 pl-4">
						<li
							v-for="(warning, index) in warnings"
							:key="index"
						>
							{{ warning }}
						</li>
					</ul>
				</el-alert>
			</div>
		</template>

		<div
			v-for="(problem, index) in problems"
			:key="index"
			data-test-id="import-problem"
		>
			<el-alert
				type="error"
				:title="problem"
				:closable="false"
				class="mt-2!"
			/>
		</div>

		<template #footer>
			<el-button
				v-if="preparation !== null"
				:disabled="submitting"
				link
				class="mr-2"
				data-test-id="import-back"
				@click="onBack"
			>
				{{ t('automations.templates.buttons.back.title') }}
			</el-button>

			<el-button
				:disabled="submitting"
				data-test-id="import-cancel"
				@click="onVisible(false)"
			>
				{{ t('automations.buttons.cancel.title') }}
			</el-button>

			<el-button
				v-if="preparation === null"
				type="primary"
				:loading="submitting"
				:disabled="yaml.trim() === '' || submitting"
				data-test-id="import-continue"
				@click="prepare"
			>
				{{ t('automations.templates.buttons.continue.title') }}
			</el-button>

			<el-button
				v-else
				type="primary"
				:loading="submitting"
				:disabled="submitting"
				data-test-id="import-create"
				@click="onCreate"
			>
				{{ t('automations.transfer.buttons.import.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
/*
 * "Import YAML": read an automation from a file, point what it refers to that does not exist here at entities of
 * this installation, and create it, disabled. The backend reads and checks the file; the automation is created
 * through the ordinary create request.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDescriptions, ElDescriptionsItem, ElDialog, ElInput, ElOption, ElSelect, ElTag, ElText, ElUpload } from 'element-plus';
import type { UploadFile } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useDevices } from '../../../devices/composables/useDevices';
import { useScenes } from '../../../scenes/composables/useScenes';
import { AutomationReferenceKind } from '../../automations.constants';
import { AUTOMATION_REMAPPABLE_REFERENCE_KINDS, automationReferenceKey, useAutomationImport } from '../../composables/useAutomationImport';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { useAutomationSpaces } from '../../composables/useAutomationSpaces';
import { useAutomations } from '../../composables/useAutomations';
import type { IAutomationImportMissingReference } from '../../store/transfer.store.types';
import AutomationNodeTarget from '../nodes/automation-node-target.vue';

import type { IAutomationImportDialogProps } from './automation-import-dialog.types';

defineOptions({
	name: 'AutomationImportDialog',
});

interface IPropertyTarget {
	device_id: string | null;
	channel_id: string | null;
	property_id: string | null;
}

interface IOption {
	value: string;
	label: string;
}

const props = defineProps<IAutomationImportDialogProps>();

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
	// The automation was created, disabled
	(e: 'imported', id: string): void;
}>();

const { t } = useI18n();

const {
	yaml,
	preparation,
	missingReferences,
	fileIssues,
	graphIssues,
	submitting,
	setYaml,
	readFile,
	setMapping,
	mappingFor,
	prepare,
	create,
	reset,
} = useAutomationImport();

const { devices } = useDevices();
const { scenes } = useScenes();
const { spacesOptions, fetchSpaces } = useAutomationSpaces();
const { automations } = useAutomations();
const { ensureDevices, ensureScenes, ensureAutomations } = useAutomationNodeLookups();

// What the property picker of each missing property shows; only the property chosen is sent
const propertyTargets = ref<Record<string, IPropertyTarget>>({});

const referenceKey = automationReferenceKey;

const remappable = (reference: IAutomationImportMissingReference): boolean =>
	reference.remappable && AUTOMATION_REMAPPABLE_REFERENCE_KINDS.includes(reference.kind);

const byLabel = (a: IOption, b: IOption): number => a.label.localeCompare(b.label);

const optionsFor = (reference: IAutomationImportMissingReference): IOption[] => {
	switch (reference.kind) {
		case AutomationReferenceKind.device:
			return devices.value.map((device) => ({ value: device.id, label: device.name })).sort(byLabel);
		case AutomationReferenceKind.scene:
			return scenes.value.map((scene) => ({ value: scene.id, label: scene.name })).sort(byLabel);
		case AutomationReferenceKind.space:
			return spacesOptions.value.map((space) => ({ value: space.value, label: space.label }));
		case AutomationReferenceKind.automation:
			return automations.value.map((automation) => ({ value: automation.id, label: automation.name })).sort(byLabel);
		default:
			return [];
	}
};

const usedBy = (reference: IAutomationImportMissingReference): string => {
	const nodes = [...new Set(reference.usages.map((usage) => usage.nodeId).filter((nodeId): nodeId is string => nodeId !== null))];

	if (nodes.length === 0) {
		return t('automations.transfer.texts.usedByAutomation');
	}

	return t('automations.transfer.texts.usedByNodes', { nodes: nodes.join(', ') }, nodes.length);
};

const propertyTarget = (reference: IAutomationImportMissingReference): IPropertyTarget =>
	propertyTargets.value[referenceKey(reference)] ?? { device_id: null, channel_id: null, property_id: null };

const onPropertyTarget = (
	reference: IAutomationImportMissingReference,
	patch: { device_id?: string; channel_id?: string; property_id?: string }
): void => {
	const next: IPropertyTarget = { ...propertyTarget(reference) };

	for (const field of ['device_id', 'channel_id', 'property_id'] as const) {
		if (field in patch) {
			next[field] = patch[field] ?? null;
		}
	}

	propertyTargets.value = { ...propertyTargets.value, [referenceKey(reference)]: next };

	setMapping(reference, next.property_id);
};

const warnings = computed<string[]>((): string[] =>
	(preparation.value?.issues ?? []).map((issue) => (issue.node_id ? `${issue.node_id}: ${issue.message}` : issue.message))
);

const problems = computed<string[]>((): string[] => [
	...fileIssues.value.map((issue) => `${issue.field}: ${issue.reason}`),
	...graphIssues.value.map((issue) => (issue.node_id ? `${issue.node_id}: ${issue.message}` : issue.message)),
]);

const onFile = (file: UploadFile): void => {
	if (file.raw) {
		void readFile(file.raw);
	}
};

const onBack = (): void => {
	preparation.value = null;
	propertyTargets.value = {};
};

const onVisible = (visible: boolean): void => {
	if (!visible && submitting.value) {
		return;
	}

	emit('update:visible', visible);

	if (!visible) {
		reset();
		propertyTargets.value = {};
	}
};

const onCreate = async (): Promise<void> => {
	const id = await create();

	if (id === null) {
		return;
	}

	reset();
	propertyTargets.value = {};

	emit('update:visible', false);
	emit('imported', id);
};

// What a missing reference can be pointed at is read when the dialog opens, not with the list behind it
const onOpen = (): void => {
	void ensureDevices();
	void ensureScenes();
	void ensureAutomations();

	fetchSpaces().catch((): void => {
		// A space reference then offers no space to choose
	});
};
</script>

<style scoped>
.automation-import-dialog__reference {
	border-color: var(--el-border-color);
}

.automation-import-dialog__yaml :deep(textarea) {
	font-family: var(--el-font-family-monospace, monospace);
}
</style>
