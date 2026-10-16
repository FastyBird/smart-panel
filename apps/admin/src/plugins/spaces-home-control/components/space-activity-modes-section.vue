<template>
	<el-card
		v-loading="loading"
		shadow="never"
		class="m-2"
	>
		<template #header>
			<h3 class="m-0">{{ text('title') }}</h3>
		</template>
		<p>{{ text('description') }}</p>
		<el-alert
			v-if="error"
			:title="text(error)"
			type="warning"
			:closable="false"
			show-icon
		/>
		<el-button
			v-if="error === 'loadFailed'"
			@click="load"
		>
			{{ text('refresh') }}
		</el-button>
		<p v-if="!canEdit">{{ text('readOnly') }}</p>
		<div
			v-for="mode in configs"
			:key="mode.activity_mode"
			class="flex flex-wrap items-center gap-3 py-2"
		>
			<icon :icon="icons[mode.activity_mode]" />
			<strong class="flex-1">{{ text(`modes.${mode.activity_mode}`) }}</strong>
			<el-switch
				:model-value="mode.activity_enabled"
				:disabled="!canEdit || busy || loading"
				:aria-label="`${text(`modes.${mode.activity_mode}`)}: ${text('enabled')}`"
				:data-testid="`toggle-${mode.activity_mode}`"
				@change="(enabled) => toggle(mode, enabled === true)"
			/>
			<el-tag :type="mode.activity_enabled ? 'success' : 'info'">{{ text(mode.activity_enabled ? 'enabled' : 'disabled') }}</el-tag>
			<span>{{ text('order') }}: {{ mode.activity_order }}</span>
			<el-button
				:disabled="busy || loading"
				:data-testid="`edit-${mode.activity_mode}`"
				@click="edit(mode)"
			>
				{{ text('edit') }}
			</el-button>
		</div>
		<p v-if="!loading && !configs.length">{{ text('missing') }}</p>
	</el-card>
	<el-dialog
		v-model="visible"
		:title="text('edit')"
		width="min(680px, 94vw)"
		destroy-on-close
		:close-on-click-modal="false"
		:before-close="close"
	>
		<template v-if="draft && selected">
			<h3>{{ text(`modes.${selected.activity_mode}`) }}</h3>
			<el-alert
				v-if="error && error !== 'conflict'"
				:title="text(error)"
				type="error"
				:closable="false"
			/>
			<el-alert
				v-if="error === 'conflict'"
				:title="text('conflict')"
				:description="text('conflictReview')"
				type="warning"
				:closable="false"
			/>
			<el-button
				v-if="error === 'conflict'"
				@click="discard"
			>
				{{ text('discard') }}
			</el-button>
			<el-form
				label-position="top"
				:disabled="!canEdit || busy || previewing"
			>
				<el-form-item :label="text('enabled')">
					<el-switch
						v-model="draft.enabled"
						data-testid="mode-enabled"
					/>
				</el-form-item>
				<el-form-item :label="text('order')">
					<el-input-number
						v-model="draft.display_order"
						:min="0"
						:max="1000"
						:precision="0"
						data-testid="mode-order"
					/>
					<p class="w-full">{{ text('orderHelp') }}</p>
				</el-form-item>
				<fieldset
					v-for="domain in domains"
					:key="domain"
					class="mb-4 p-3 border-solid border border-[var(--el-border-color)] rounded"
				>
					<legend>{{ text(domain) }}</legend>
					<el-form-item :label="text('enabled')">
						<el-switch
							v-model="draft.configuration[domain].enabled"
							:data-testid="`${domain}-enabled`"
						/>
					</el-form-item>
					<template v-if="domain === 'lighting'">
						<el-form-item :label="text('lightingMode')">
							<el-select
								v-model="draft.configuration.lighting.mode"
								@change="lightingChanged"
							>
								<el-option
									v-for="value in LightingMode"
									:key="value"
									:value="value"
									:label="text(`lightingModes.${value}`)"
								/>
							</el-select>
						</el-form-item>
						<el-form-item
							v-if="draft.configuration.lighting.mode !== LightingMode.off"
							:label="text('brightness')"
						>
							<el-input-number
								:model-value="draft.configuration.lighting.brightness"
								:min="0"
								:max="100"
								:precision="0"
								:placeholder="text('defaultBrightness')"
								@update:model-value="brightnessChanged"
							/>
						</el-form-item>
					</template>
					<template v-if="domain === 'climate'">
						<el-alert
							:title="text('climateUnsupported')"
							type="warning"
							:closable="false"
							class="mb-3"
						/>
						<el-form-item :label="text('climateKind')">
							<el-select
								:model-value="climateKind"
								data-testid="climate-kind"
								@update:model-value="setClimateKind"
							>
								<el-option
									v-for="value in climateKinds"
									:key="value"
									:value="value"
									:label="text(`climateKinds.${value}`)"
								/>
							</el-select>
						</el-form-item>
						<el-form-item
							v-if="climateKind === 'preset'"
							:label="text('preset')"
						>
							<el-select v-model="draft.configuration.climate.thermostat_preset">
								<el-option
									v-for="value in Preset"
									:key="value"
									:value="value"
									:label="text(`presets.${value}`)"
								/>
							</el-select>
						</el-form-item>
						<template v-if="climateKind === 'setpoint' || climateKind === 'delta'">
							<el-form-item :label="text('climateMode')">
								<el-select v-model="draft.configuration.climate.mode">
									<el-option
										v-for="value in [ClimateMode.heat, ClimateMode.cool]"
										:key="value"
										:value="value"
										:label="text(`climateModes.${value}`)"
									/>
								</el-select>
							</el-form-item>
							<el-form-item :label="text(climateKind)">
								<el-input-number
									v-if="climateKind === 'setpoint'"
									v-model="draft.configuration.climate.setpoint"
									:precision="1"
									:step="0.5"
								/>
								<el-input-number
									v-else
									v-model="draft.configuration.climate.setpoint_delta"
									:precision="1"
									:step="0.5"
								/>
							</el-form-item>
						</template>
					</template>
					<el-form-item
						v-if="domain === 'covers'"
						:label="text('position')"
					>
						<el-input-number
							v-model="draft.configuration.covers.position"
							:min="0"
							:max="100"
							:precision="0"
						/>
					</el-form-item>
					<el-form-item
						v-if="domain === 'media'"
						:label="text('mediaActivity')"
					>
						<el-select v-model="draft.configuration.media.activity">
							<el-option
								v-for="value in MediaActivity"
								:key="value"
								:value="value"
								:label="text(`mediaActivities.${value}`)"
							/>
						</el-select>
					</el-form-item>
					<el-alert
						v-if="domain === 'security'"
						:title="text('securityUnsupported')"
						type="warning"
						:closable="false"
					/>
				</fieldset>
			</el-form>
			<el-alert
				v-if="!valid"
				:title="text('invalid')"
				type="warning"
				:closable="false"
			/>
			<p>{{ text(dirty ? 'saveBeforePreview' : 'previewDescription') }}</p>
			<el-button
				:disabled="dirty || busy || previewing || error === 'conflict'"
				:loading="previewing"
				data-testid="preview"
				@click="showPreview"
			>
				{{ text('preview') }}
			</el-button>
			<el-alert
				v-if="previewError"
				:title="text('loadFailed')"
				type="error"
				:closable="false"
			/>
			<div
				v-for="result in previewResults"
				:key="result.domain"
				class="py-2"
				data-testid="domain-result"
			>
				<strong>{{ text(result.domain) }}</strong>
				: {{ text(`statuses.${result.status}`) }}
				<p v-if="result.status === 'unsupported' && ['climate', 'security'].includes(result.domain)">{{ text(`${result.domain}Unsupported`) }}</p>
				<p v-else-if="previewReason(result.reason)">{{ previewReason(result.reason) }}</p>
			</div>
		</template>
		<template #footer>
			<el-button
				:disabled="busy"
				@click="visible = false"
			>
				{{ text('cancel') }}
			</el-button>
			<el-button
				:disabled="!canEdit || busy || previewing || error === 'conflict'"
				data-testid="reset"
				@click="reset"
			>
				{{ text('reset') }}
			</el-button>
			<el-button
				type="primary"
				:disabled="!canEdit || !valid || !dirty || busy || previewing || error === 'conflict'"
				:loading="busy"
				data-testid="save"
				@click="save"
			>
				{{ text('save') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElDialog, ElForm, ElFormItem, ElInputNumber, ElOption, ElSelect, ElSwitch, ElTag, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useSession } from '../../../modules/auth/composables/useSession';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { ActivityDraftSchema, ClimateMode, LightingMode, MediaActivity, Preset } from '../composables/activityModes.schemas';
import {
	type ActivityConfig,
	type ActivityDraft,
	ActivityMode,
	type ActivityPreview,
	activityDraft,
	useSpaceActivityModes,
} from '../composables/useSpaceActivityModes';

const props = defineProps<{ spaceId: string }>();
const { t } = useI18n();
const text = (key: string) => t(`spacesHomeControlPlugin.activityModes.${key}`);
const { profile } = useSession();
const canEdit = computed(() => profile.value?.role === UsersModuleUserRole.owner || profile.value?.role === UsersModuleUserRole.admin);
const { configs, loading, busy, error, load, write, preview } = useSpaceActivityModes(computed(() => props.spaceId));
const visible = ref(false);
const selected = ref<ActivityConfig | null>(null);
const draft = ref<ActivityDraft | null>(null);
const previewResults = ref<ActivityPreview | null>(null);
const previewing = ref(false);
const previewError = ref(false);
let previewGeneration = 0;
const domains = ['lighting', 'climate', 'covers', 'media', 'security'] as const;
const icons: Record<ActivityMode, string> = {
	work: 'mdi:briefcase',
	relax: 'mdi:sofa-single',
	sleep: 'mdi:bed-king',
	entertainment: 'mdi:television-play',
	away: 'mdi:exit-run',
};
const dirty = computed(() => !!draft.value && !!selected.value && JSON.stringify(draft.value) !== JSON.stringify(activityDraft(selected.value)));
const valid = computed(() => ActivityDraftSchema.safeParse(draft.value).success);
const climateKinds = ['none', 'preset', 'setpoint', 'delta'] as const;
const climateInputKind = ref('none');
const climateKind = computed(() => climateInputKind.value);
const setClimateKind = (kind: string) => {
	if (!draft.value) return;
	// Choosing an input type does not invent a preset or a numeric intent.
	draft.value.configuration.climate = { enabled: draft.value.configuration.climate.enabled };
	climateInputKind.value = kind;
};

const selectDraft = (row: ActivityConfig) => {
	selected.value = row;
	draft.value = activityDraft(row);
	const climate = draft.value.configuration.climate;
	climateInputKind.value =
		climate.thermostat_preset !== undefined
			? 'preset'
			: climate.setpoint !== undefined
				? 'setpoint'
				: climate.setpoint_delta !== undefined
					? 'delta'
					: 'none';
	error.value = null;
};
const edit = (row: ActivityConfig) => {
	selectDraft(row);
	visible.value = true;
};
const toggle = async (row: ActivityConfig, enabled: boolean) => {
	if (!canEdit.value || busy.value || loading.value) return;
	selectDraft(row);
	const pendingDraft = draft.value;
	if (!pendingDraft) return;
	pendingDraft.enabled = enabled;
	const saved = await write(row.activity_mode, row.activity_revision, pendingDraft);
	if (saved) {
		selected.value = saved;
		draft.value = activityDraft(saved);
	} else visible.value = true;
};
const discard = () => {
	const fresh = configs.value.find((row) => row.activity_mode === selected.value?.activity_mode);
	if (fresh) edit(fresh);
};
const lightingChanged = () => {
	if (draft.value?.configuration.lighting.mode === LightingMode.off) delete draft.value.configuration.lighting.brightness;
};
const brightnessChanged = (value: number | undefined) => {
	if (!draft.value) return;
	if (value === undefined) delete draft.value.configuration.lighting.brightness;
	else draft.value.configuration.lighting.brightness = value;
};
const save = async () => {
	if (!selected.value || !draft.value || !valid.value || !canEdit.value) return;
	const row = await write(selected.value.activity_mode, selected.value.activity_revision, draft.value);
	if (row) edit(row);
};
const reset = async () => {
	if (!selected.value || !canEdit.value) return;
	const row = await write(selected.value.activity_mode, selected.value.activity_revision);
	if (row) edit(row);
};
const showPreview = async () => {
	if (!selected.value || dirty.value || busy.value || previewing.value) return;
	const token = ++previewGeneration;
	previewing.value = true;
	previewResults.value = null;
	previewError.value = false;
	try {
		const results = await preview(selected.value.activity_mode, selected.value.activity_revision);
		if (token === previewGeneration) previewResults.value = results;
	} catch {
		if (token === previewGeneration) previewError.value = true;
	} finally {
		if (token === previewGeneration) previewing.value = false;
	}
};
const previewReason = (reason: string) => {
	if (reason.startsWith('covers_require_')) return text('reasons.coversUnsupported');
	if (reason === 'operator_media_binding_missing_or_invalid') return text('reasons.mediaBindingMissing');
	if (reason === 'media_plan_empty_or_incompatible' || reason === 'media_deactivation_targets_unavailable') return text('reasons.mediaUnavailable');
	if (reason === 'no_active_media_activity') return text('reasons.noActiveMedia');
	if (reason.startsWith('no_compatible_') || reason === 'no_media_endpoints') return text('reasons.noTargets');
	return '';
};
const invalidatePreview = () => {
	previewGeneration++;
	previewResults.value = null;
	previewError.value = false;
	previewing.value = false;
};
const close = (done: () => void) => {
	if (!busy.value) done();
};
watch(draft, invalidatePreview, { deep: true, flush: 'sync' });
watch(visible, invalidatePreview);
watch(
	() => props.spaceId,
	() => {
		visible.value = false;
		selected.value = null;
		draft.value = null;
	}
);
</script>
