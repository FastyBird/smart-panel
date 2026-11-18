<template>
	<el-card
		class="border-0! shadow-none! bg-transparent!"
		body-class="p-0!"
		shadow="never"
		data-test-id="light-group-wizard"
	>
		<device-wizard-steps
			v-model="step"
			:steps="stepLabels"
			:can-advance="!authoring.pending.value && !catalog.pending.value && !loading && !!catalog.catalog.value"
			:before-next="beforeNext"
			:final-actions="wizardFinalActions"
			:dirty="step > 0 || !!name.trim() || memberIds.length > 0"
			:disabled="authoring.pending.value"
		>
			<virtual-wizard-layout
				:compact="step === 0"
				:wide="step !== 0"
				enabled
				:review="step === 2"
				:loading="loading || (catalog.pending.value && !baseCandidates.length)"
				:title="text(step === 0 ? 'detailsTitle' : step === 1 ? 'membersTitle' : 'reviewTitle')"
				:description="text(step === 0 ? 'detailsDescription' : step === 1 ? 'membersDescription' : 'reviewDescription')"
			>
				<el-button
					v-if="catalog.error.value || loadError"
					:disabled="catalog.pending.value || loading"
					class="mb-3"
					@click="reload"
				>
					{{ t('devicesVirtualPlugin.lightGroup.reload') }}
				</el-button>
				<el-form
					v-if="step === 0"
					label-position="top"
					:disabled="authoring.pending.value"
					status-icon
					@submit.prevent
				>
					<el-form-item
						:error="validation.error('name')"
						:label="t('devicesModule.fields.devices.name.title')"
						required
					>
						<el-input
							v-model="name"
							:placeholder="t('devicesModule.fields.devices.name.placeholder')"
							data-test-id="group-name"
						/>
					</el-form-item>
					<el-form-item
						:error="validation.error('profile')"
						:label="text('groupOf')"
						required
					>
						<div class="group-profile-picker">
							<el-radio-group
								v-model="profile"
								class="group-profile-picker__buttons"
								data-test-id="group-profile"
								:aria-label="text('groupOf')"
							>
								<el-radio-button
									v-for="option in catalog.profiles.value"
									:key="option.profile"
									:value="option.profile"
								>
									{{ groupName(option.profile) }}
								</el-radio-button>
							</el-radio-group>
							<el-select
								v-model="profile"
								class="group-profile-picker__select"
								:aria-label="text('groupOf')"
							>
								<el-option
									v-for="option in catalog.profiles.value"
									:key="option.profile"
									:value="option.profile"
									:label="groupName(option.profile)"
								/>
							</el-select>
							<p class="virtual-wizard-field-help">{{ text('profileHelp') }}</p>
						</div>
					</el-form-item>
					<virtual-placement-fields
						v-model:room-id="roomId"
						v-model:zone-ids="zoneIds"
						suggest-sources
						:disabled="authoring.pending.value"
					/>
				</el-form>
				<el-alert
					v-if="profile === 'cover' && step < 2"
					:title="text('coverHelp')"
					type="info"
					:closable="false"
					class="mb-3"
				/>
				<section
					v-if="step === 1"
					class="group-members"
				>
					<virtual-wizard-card
						v-if="selectedMembers.length"
						v-loading="catalog.pending.value"
						icon="mdi:format-list-checks"
						flush
					>
						<template #header>
							<h4 class="group-members__heading">
								{{ t('devicesVirtualPlugin.lightGroup.members') }}
								<el-tag
									size="small"
									type="info"
								>
									{{ memberIds.length }}
								</el-tag>
							</h4>
						</template>
						<virtual-group-capability-matrix
							:members="selectedMembers"
							:columns="capabilityColumns"
							:available-capabilities="availableCapabilities"
							:selected-capabilities="selectedCapabilities"
							:required-capabilities="requiredCapabilities"
							:disabled="authoring.pending.value"
							:controls-disabled="catalog.pending.value || !catalog.catalog.value"
							@remove="removeMember"
							@toggle="toggleCapability"
						/>
					</virtual-wizard-card>
					<el-form
						label-position="top"
						class="mt-2"
						status-icon
						@submit.prevent
					>
						<el-form-item :error="validation.error('members') || validation.error('capabilities')" />
					</el-form>
					<el-text
						size="small"
						class="block mb-5"
					>
						{{ text('controlsAdvice') }}
					</el-text>
					<virtual-wizard-add-sources
						:sources="availableMembers"
						:selected-ids="memberIds"
						:title="text('addMembers')"
						:room-id="roomId"
						:zone-ids="zoneIds"
						:disabled="authoring.pending.value || catalog.pending.value || !catalog.catalog.value || memberIds.length >= 256"
						@add="addMember"
					/>
				</section>
				<template v-if="step === 2">
					<virtual-wizard-review-section
						:title="t('devicesVirtualPlugin.wizard.steps.details')"
						:disabled="authoring.pending.value"
						@edit="step = 0"
					>
						<virtual-wizard-descriptions
							:column="2"
							data-test-id="group-summary"
						>
							<el-descriptions-item :label="t('devicesModule.fields.devices.name.title')">{{ name }}</el-descriptions-item>
							<el-descriptions-item :label="text('groupOf')">{{ groupName(profile) }}</el-descriptions-item>
							<el-descriptions-item :label="t('devicesModule.fields.devices.room.title')">{{ roomName(roomId) }}</el-descriptions-item>
							<el-descriptions-item :label="t('devicesModule.fields.devices.zones.title')">{{ zoneNames(zoneIds) }}</el-descriptions-item>
						</virtual-wizard-descriptions>
					</virtual-wizard-review-section>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<virtual-wizard-review-section
							:title="t('devicesVirtualPlugin.lightGroup.members')"
							:count="reviewMembers.length"
							padded
							:disabled="authoring.pending.value"
							@edit="step = 1"
						>
							<div
								v-for="member in reviewMembers"
								:key="member.id"
								class="group-review-member"
							>
								<strong>{{ member.name }}</strong>
								<el-text
									size="small"
									class="block"
								>
									{{ member.detail }} · {{ member.room }}
								</el-text>
							</div>
						</virtual-wizard-review-section>
						<virtual-wizard-review-section
							:title="text('controls')"
							:count="reviewControls.length"
							:disabled="authoring.pending.value"
							@edit="step = 1"
						>
							<virtual-wizard-descriptions
								:column="1"
								data-test-id="group-review-controls"
							>
								<el-descriptions-item
									v-for="capability in reviewControls"
									:key="capability.category"
									:label="categoryLabel(capability.category)"
								>
									{{ capabilityValue(capability) }}
								</el-descriptions-item>
							</virtual-wizard-descriptions>
						</virtual-wizard-review-section>
					</div>
				</template>
				<template #aside>
					<virtual-wizard-summary
						:title="name"
						:subtitle="`${t('devicesVirtualPlugin.wizard.kinds.group.title')} · ${groupName(profile)}`"
						:items="sidebarItems"
					/>
				</template>
			</virtual-wizard-layout>
		</device-wizard-steps>
	</el-card>
</template>
<script setup lang="ts">
import { computed, onBeforeMount, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElDescriptionsItem,
	ElForm,
	ElFormItem,
	ElInput,
	ElOption,
	ElRadioButton,
	ElRadioGroup,
	ElSelect,
	ElTag,
	ElText,
	vLoading,
} from 'element-plus';

import { injectStoresManager } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import { useDeviceWizardComplete } from '../../../modules/devices/components/wizard/device-wizard-flow';
import DeviceWizardSteps from '../../../modules/devices/components/wizard/device-wizard-steps.vue';
import type { IWizardAction } from '../../../modules/devices/components/wizard/device-wizard.types';
import { useWizardValidation } from '../../../modules/devices/components/wizard/use-wizard-validation';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import { spacesStoreKey } from '../../../modules/spaces/store/keys';
import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';
import VirtualGroupCapabilityMatrix from '../components/virtual-group-capability-matrix.vue';
import VirtualPlacementFields from '../components/virtual-placement-fields.vue';
import VirtualWizardAddSources from '../components/virtual-wizard-add-sources.vue';
import VirtualWizardCard from '../components/virtual-wizard-card.vue';
import VirtualWizardDescriptions from '../components/virtual-wizard-descriptions.vue';
import VirtualWizardLayout from '../components/virtual-wizard-layout.vue';
import VirtualWizardReviewSection from '../components/virtual-wizard-review-section.vue';
import VirtualWizardSummary from '../components/virtual-wizard-summary.vue';
import { usePlacementNames } from '../composables/use-placement-names';
import { useVirtualWizardError } from '../composables/use-virtual-wizard-error';
import { provideVirtualWizardPlacement } from '../composables/use-virtual-wizard-placement';
import { type GroupProfile, useGroupCatalog } from '../composables/useGroupCatalog';
import { useLightGroupAuthoring } from '../composables/useLightGroupAuthoring';
import type { GroupCandidate, GroupCapability, GroupCategory, GroupMemberOption } from '../utils/group-authoring.types';
import { groupCapabilityColumns, updateGroupCapabilitySelection } from '../utils/group-capability-presentation';

const { t } = useI18n();
const text = (key: string, params = {}) => t(`devicesVirtualPlugin.lightGroup.wizard.${key}`, params);
const groupName = (value: GroupProfile) => t(`devicesVirtualPlugin.lightGroup.wizard.groupNames.${value}`);
const categoryLabel = (category: string) => t(`devicesModule.categories.channelsProperties.${category}`);
const complete = useDeviceWizardComplete();
const router = useRouter();
const stores = injectStoresManager();
const devices = stores.getStore(devicesStoreKey),
	channels = stores.getStore(channelsStoreKey),
	properties = stores.getStore(channelsPropertiesStoreKey),
	spaces = stores.getStore(spacesStoreKey);
const authoring = useLightGroupAuthoring(),
	catalog = useGroupCatalog();
const profile = ref<GroupProfile>('light' as GroupProfile),
	step = ref(0),
	name = ref(''),
	roomId = ref<string | null>(null),
	zoneIds = ref<string[]>([]),
	memberIds = ref<string[]>([]);
const loading = ref(true),
	loadError = ref(false);
const { roomName, zoneNames } = usePlacementNames();
const baseCandidates = shallowRef<GroupCandidate[]>([]);
const excludedCapabilities = ref<GroupCategory[]>([]);
const requiredCapabilities = computed(
	() => catalog.profiles.value.find((entry) => entry.profile === profile.value)?.required_capabilities ?? ['on' as GroupCategory]
);
const currentCandidates = computed(() => new Map((catalog.catalog.value?.candidates ?? []).map((candidate) => [candidate.channel, candidate])));
// Keep the previous display while compatibility is loading. Actions use only the current catalog.
const retainedCapabilities = shallowRef<GroupCapability[]>([]);
watch(catalog.catalog, (value) => {
	if (value) retainedCapabilities.value = value.candidates.find((candidate) => candidate.channel === memberIds.value[0])?.common_capabilities ?? [];
});
const availableCapabilities = computed(() =>
	!memberIds.value.length
		? []
		: catalog.catalog.value
			? (currentCandidates.value.get(memberIds.value[0])?.common_capabilities ?? [])
			: retainedCapabilities.value
);

const selectedCapabilities = computed<GroupCategory[]>(() =>
	availableCapabilities.value
		.map((capability) => capability.category)
		.filter((category) => requiredCapabilities.value.includes(category) || !excludedCapabilities.value.includes(category))
);
const capabilityColumns = computed(() =>
	groupCapabilityColumns(
		profile.value,
		baseCandidates.value.flatMap((candidate) => candidate.common_capabilities?.map((capability) => capability.category) ?? [])
	)
);
const toggleCapability = (category: GroupCategory, enabled: boolean) => {
	const previous = selectedCapabilities.value;
	const desired = enabled ? [...previous, category] : previous.filter((value) => value !== category);
	const next = updateGroupCapabilitySelection(
		previous,
		desired,
		availableCapabilities.value.map((capability) => capability.category),
		requiredCapabilities.value
	);
	const available = new Set(availableCapabilities.value.map((capability) => capability.category));
	excludedCapabilities.value = [
		...new Set([...excludedCapabilities.value.filter((value) => !available.has(value)), ...[...available].filter((value) => !next.includes(value))]),
	];
};
const memberOptions = computed<GroupMemberOption[]>(() => {
	const deviceMap = new Map(devices.findAll().map((device) => [device.id, device]));
	const channelMap = new Map(channels.findAll().map((channel) => [channel.id, channel]));
	return baseCandidates.value.map((candidate) => {
		const device = deviceMap.get(candidate.device),
			channel = channelMap.get(candidate.channel);
		return {
			id: candidate.channel,
			name: device?.name ?? candidate.name,
			detail: channel?.name ?? candidate.name,
			roomId: device?.roomId ?? null,
			zoneIds: device?.zoneIds ?? [],
			room: roomName(device?.roomId ?? null),
			capabilities: candidate.common_capabilities ?? [],
			eligible: candidate.eligible,
			reasons: candidate.reasons,
		};
	});
});
const selectedMembers = computed<GroupMemberOption[]>(() =>
	memberIds.value.map(
		(id) =>
			memberOptions.value.find((candidate) => candidate.id === id) ?? {
				id,
				name: t('devicesVirtualPlugin.lightGroup.missingMember', { identity: id }),
				detail: '',
				roomId: null,
				room: '—',
				capabilities: [],
				eligible: false,
				reasons: [],
			}
	)
);
const availableMembers = computed(() =>
	memberOptions.value.map((member) => {
		const proposed = currentCandidates.value.get(member.id);
		const lost = proposed
			? selectedCapabilities.value.filter((category) => !proposed.common_capabilities.some((capability) => capability.category === category))
			: [];
		const reason = (proposed ?? member).reasons[0];
		const disabledReason = reason?.startsWith('group_capability_incompatible:')
			? text('missingControl', { control: categoryLabel(reason.split(':')[1]) })
			: reason
				? text('incompatibleMember')
				: undefined;
		return {
			...member,
			disabled: !(proposed ?? member).eligible,
			disabledReason,
			badge:
				!memberIds.value.length || !proposed?.eligible
					? undefined
					: {
							label: lost.length
								? text('removesControls', { count: lost.length })
								: text('keepsControls', { count: selectedCapabilities.value.length }),
							type: lost.length ? ('warning' as const) : ('success' as const),
						},
		};
	})
);
const addMember = (id: string) => {
	if (
		authoring.pending.value ||
		catalog.pending.value ||
		!catalog.catalog.value ||
		memberIds.value.length >= 256 ||
		memberIds.value.includes(id) ||
		!availableMembers.value.some((member) => member.id === id && !member.disabled)
	)
		return;
	memberIds.value = [...memberIds.value, id];
};
const removeMember = (id: string) => {
	if (!authoring.pending.value) memberIds.value = memberIds.value.filter((value) => value !== id);
};
watch(profile, () => {
	memberIds.value = [];
	excludedCapabilities.value = [];
});
const metadataSignature = computed(() =>
	JSON.stringify(
		properties
			.findAll()
			.map(({ id, category, dataType, format, step, permissions, unit }) => ({ id, category, dataType, format, step, permissions, unit }))
	)
);
let baseKey = '',
	generation = 0,
	catalogReady = false;
const refreshCatalog = async () => {
	if (step.value === 2 || authoring.pending.value) return;
	const current = ++generation,
		selectedProfile = profile.value;
	const metadataKey = JSON.stringify([selectedProfile, metadataSignature.value]);
	authoring.invalidatePreview();
	let loadedBaseline = false;
	if (baseKey !== metadataKey) {
		baseCandidates.value = [];
		const result = await catalog.load({ profile: selectedProfile, selected_channels: [] });
		if (!result || current !== generation) return;
		baseCandidates.value = result.candidates;
		baseKey = metadataKey;
		loadedBaseline = true;
	}
	if (memberIds.value.length || !loadedBaseline) await catalog.load({ profile: selectedProfile, selected_channels: [...memberIds.value] });
};
watch(
	[profile, () => memberIds.value.join('|'), metadataSignature, () => step.value === 2],
	() => {
		if (catalogReady) void refreshCatalog();
	},
	{ flush: 'post' }
);
watch(excludedCapabilities, () => authoring.invalidatePreview(), { flush: 'sync' });
const stepLabels = computed(() => [
	t('devicesVirtualPlugin.wizard.steps.details'),
	text('membersControls'),
	t('devicesVirtualPlugin.wizard.steps.review'),
]);
const validation = useWizardValidation(step, () => {
	if (step.value === 0)
		return {
			name: name.value.trim() ? undefined : t('devicesModule.fields.devices.name.validation.required'),
			profile: catalog.profiles.value.some((option) => option.profile === profile.value)
				? undefined
				: t('devicesModule.wizard.validation.invalidValue'),
		};
	return {
		members:
			memberIds.value.length >= 2 && memberIds.value.every((id) => currentCandidates.value.get(id)?.eligible)
				? undefined
				: t('devicesModule.wizard.validation.minimumItems', { count: 2 }),
		capabilities:
			availableCapabilities.value.length && requiredCapabilities.value.every((category) => selectedCapabilities.value.includes(category))
				? undefined
				: t('devicesModule.wizard.validation.invalidValue'),
	};
});
const draft = () => ({
	profile: profile.value,
	members: memberIds.value.map((id) => ({ source_channel: id })),
	capabilities: [...selectedCapabilities.value],
});
const reviewMembers = shallowRef<GroupMemberOption[]>([]);
const beforeNext = async (): Promise<boolean> => {
	if (!validation.validate()) return false;
	if (step.value === 0) return true;
	const result = await authoring.previewDraft(draft());
	if (!result) return false;
	reviewMembers.value = selectedMembers.value.map((member) => ({ ...member }));
	return true;
};
const reviewControls = computed(() => authoring.preview.value?.common_capabilities ?? []);
const capabilityValue = (capability: GroupCapability) =>
	capability.data_type === 'bool'
		? text('onOff')
		: `${capability.format?.join(capability.data_type === 'enum' ? ', ' : ' – ') ?? '—'} ${capability.unit ?? ''}`.trim();
const create = async () => {
	const result = await authoring.create({ ...draft(), device: { name: name.value.trim(), room_id: roomId.value, zone_ids: zoneIds.value } });
	if (result) {
		complete();
		await router.push({ name: DevicesRouteNames.DEVICE, params: { id: result.device.id } });
	}
};
const reload = async () => {
	catalogReady = false;
	loading.value = true;
	loadError.value = false;
	try {
		await Promise.all([devices.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all }), spaces.fetch()]);
	} catch {
		loadError.value = true;
	} finally {
		loading.value = false;
	}
	baseKey = '';
	await refreshCatalog();
	catalogReady = true;
};
onBeforeMount(reload);
const wizardFinalActions = computed<IWizardAction[]>(() => [
	{
		id: 'create',
		label: t('devicesVirtualPlugin.lightGroup.create'),
		variant: 'primary',
		disabled: !name.value.trim() || !authoring.preview.value || authoring.pending.value,
		handler: create,
	},
]);
const sidebarItems = computed(() => [
	{ label: t('devicesModule.fields.devices.room.title'), value: roomName(roomId.value) },
	{ label: t('devicesVirtualPlugin.lightGroup.members'), value: memberIds.value.length ? String(memberIds.value.length) : null },
	{ label: text('controls'), value: memberIds.value.length ? selectedCapabilities.value.map(categoryLabel).join(', ') : null },
]);
provideVirtualWizardPlacement(computed(() => ({ roomId: roomId.value, zoneIds: zoneIds.value })));
useVirtualWizardError(
	() => authoring.error.value ?? catalog.error.value ?? (loadError.value ? t('devicesVirtualPlugin.lightGroup.loadFailed') : null)
);
</script>
<style scoped>
.group-profile-picker {
	container-type: inline-size;
	width: 100%;
}
.group-profile-picker__buttons {
	display: inline-flex;
	flex-wrap: nowrap;
	max-width: 100%;
}
.group-profile-picker__select {
	display: none;
}
.group-members {
	min-width: 0;
}
.group-members__heading {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0;
	font-size: 14px;
}
.group-review-member {
	padding: 12px 0;
}
.group-review-member:first-child {
	padding-top: 0;
}
.group-review-member + .group-review-member {
	border-top: 1px solid var(--el-border-color-lighter);
}
@container (max-width: 520px) {
	.group-profile-picker__buttons {
		display: none;
	}
	.group-profile-picker__select {
		display: block;
	}
}
</style>
