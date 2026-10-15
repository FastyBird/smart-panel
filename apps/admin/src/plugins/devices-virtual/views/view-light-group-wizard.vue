<template>
	<el-card data-test-id="light-group-wizard">
		<template #header>{{ t('devicesVirtualPlugin.lightGroup.createTitle') }}</template>
		<el-alert
			v-if="authoring.error.value"
			:title="authoring.error.value"
			type="error"
			:closable="false"
			show-icon
		/>
		<el-alert
			v-if="authoring.repairConflict.value"
			:title="t('devicesVirtualPlugin.lightGroup.revisionConflict')"
			type="warning"
			:closable="false"
		/>
		<el-form
			label-position="top"
			@submit.prevent
		>
			<el-form-item :label="t('devicesVirtualPlugin.fields.devices.name.title')"><el-input v-model="name" /></el-form-item>
			<el-form-item :label="t('devicesVirtualPlugin.lightGroup.profile')">
				<el-select
					v-model="profile"
					:disabled="authoring.pending.value"
					data-test-id="group-profile"
				>
					<el-option
						v-for="option in catalog.profiles.value"
						:key="option.profile"
						:value="option.profile"
						:label="t(`devicesVirtualPlugin.lightGroup.profiles.${option.profile}`)"
					/>
				</el-select>
			</el-form-item>
			<el-alert
				v-if="profile === 'cover'"
				:title="t('devicesVirtualPlugin.lightGroup.coverTypeGuide')"
				type="info"
				:closable="false"
			/>
			<el-alert
				v-if="catalog.error.value"
				:title="catalog.error.value"
				type="error"
				:closable="false"
			/>
			<el-form-item :label="t('devicesVirtualPlugin.lightGroup.members')">
				<virtual-light-group-members
					v-model="memberIds"
					:disabled="authoring.pending.value"
					:candidates="candidates"
				/>
			</el-form-item>
			<el-form-item :label="t('devicesVirtualPlugin.lightGroup.room')">
				<el-select
					v-model="roomId"
					clearable
				>
					<el-option
						v-for="room in rooms"
						:key="room.id"
						:label="room.name"
						:value="room.id"
					/>
				</el-select>
			</el-form-item>
		</el-form>
		<template v-if="availableCapabilities.length">
			<el-alert
				v-if="authoring.preview.value?.unavailable_capabilities.length"
				:title="t('devicesVirtualPlugin.lightGroup.commonOnly')"
				:description="authoring.preview.value?.unavailable_capabilities.map(categoryLabel).join(', ')"
				type="info"
				:closable="false"
			/>
			<el-checkbox-group v-model="selectedCapabilities">
				<el-checkbox
					v-for="capability in availableCapabilities"
					:key="capability.category"
					:value="capability.category"
					:disabled="requiredCapabilities.includes(capability.category)"
				>
					{{ categoryLabel(capability.category) }}
				</el-checkbox>
			</el-checkbox-group>
			<ul>
				<li
					v-for="capability in authoring.preview.value?.common_capabilities ?? []"
					:key="capability.category"
				>
					{{ categoryLabel(capability.category) }} {{ capability.unit ?? '' }}
					{{ capability.format?.join(capability.data_type === 'enum' ? ', ' : ' – ') ?? '' }}
					{{ capability.step === null ? '' : t('devicesVirtualPlugin.lightGroup.step', { value: capability.step }) }}
				</li>
			</ul>
		</template>
		<el-button
			:disabled="memberIds.length < 2 || authoring.pending.value"
			@click="preview"
		>
			{{ t('devicesVirtualPlugin.lightGroup.preview') }}
		</el-button>
		<el-button
			type="primary"
			:disabled="!name.trim() || !authoring.preview.value || authoring.pending.value"
			:loading="authoring.pending.value"
			@click="create"
		>
			{{ t('devicesVirtualPlugin.lightGroup.create') }}
		</el-button>
		<el-button @click="cancel">{{ t('devicesVirtualPlugin.lightGroup.cancel') }}</el-button>
	</el-card>
</template>
<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElAlert, ElButton, ElCard, ElCheckbox, ElCheckboxGroup, ElForm, ElFormItem, ElInput, ElOption, ElSelect } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import { spacesStoreKey } from '../../../modules/spaces/store/keys';
import type { components } from '../../../openapi';
import VirtualLightGroupMembers from '../components/virtual-light-group-members.vue';
import { type GroupProfile, useGroupCatalog } from '../composables/useGroupCatalog';
import { useLightGroupAuthoring } from '../composables/useLightGroupAuthoring';

const { t } = useI18n();
const router = useRouter();
const stores = injectStoresManager();
const devices = stores.getStore(devicesStoreKey);
const channels = stores.getStore(channelsStoreKey);
const properties = stores.getStore(channelsPropertiesStoreKey);
const spaces = stores.getStore(spacesStoreKey);
const authoring = useLightGroupAuthoring();
const catalog = useGroupCatalog();
const profile = ref<GroupProfile>('light' as GroupProfile);
const requiredCapabilities = computed(() => catalog.profiles.value.find((entry) => entry.profile === profile.value)?.required_capabilities ?? ['on']);
const name = ref('');
const roomId = ref<string | null>(null);
const memberIds = ref<string[]>([]);
const capabilities = ref<components['schemas']['DevicesVirtualPluginLightGroupDraft']['capabilities']>(undefined);
const availableCapabilities = ref<components['schemas']['DevicesVirtualPluginDataLightGroupCapability'][]>([]);
const selectedCapabilities = computed({
	get: () => capabilities.value ?? availableCapabilities.value.map((capability) => capability.category),
	set: (values) => {
		const previous = capabilities.value ?? availableCapabilities.value.map((capability) => capability.category);
		const complete = new Set<string>([...requiredCapabilities.value, ...values]);
		for (const tuple of [
			['color_red', 'color_green', 'color_blue'],
			['hue', 'saturation'],
		]) {
			if (tuple.some((category) => previous.includes(category as (typeof previous)[number]) && !complete.has(category)))
				tuple.forEach((category) => complete.delete(category));
			else if (tuple.some((category) => complete.has(category))) tuple.forEach((category) => complete.add(category));
		}
		capabilities.value = [...complete] as typeof capabilities.value;
	},
});

const rooms = computed(() => spaces.findAll().filter((space) => space.type === 'room'));
const candidates = computed(() =>
	(catalog.catalog.value?.candidates ?? []).map((candidate) => ({
		id: candidate.channel,
		eligible: candidate.eligible,
		label: `${candidate.name}${candidate.reasons.length ? ` — ${candidate.reasons.join('; ')}` : ''}`,
	}))
);
const metadataSignature = computed(() =>
	JSON.stringify(
		properties
			.findAll()
			.map(({ id, category, dataType, format, step, permissions, unit }) => ({ id, category, dataType, format, step, permissions, unit }))
	)
);
watch(
	[profile, memberIds, metadataSignature],
	() => {
		capabilities.value = undefined;
		availableCapabilities.value = [];
		authoring.invalidatePreview();
		void catalog.load({ profile: profile.value, selected_channels: memberIds.value });
	},
	{ deep: true, immediate: true }
);
watch(profile, () => {
	memberIds.value = [];
});

const categoryLabel = (category: string) => t(`devicesModule.categories.channelsProperties.${category}`);
const draft = () => ({
	profile: profile.value,
	members: memberIds.value.map((id) => ({ source_channel: id })),
	...(capabilities.value ? { capabilities: capabilities.value } : {}),
});
watch(
	memberIds,
	() => {
		capabilities.value = undefined;
		availableCapabilities.value = [];
		authoring.invalidatePreview();
	},
	{ deep: true }
);
watch(
	capabilities,
	() => {
		authoring.invalidatePreview();
		void catalog.load({ profile: profile.value, selected_channels: memberIds.value, capabilities: capabilities.value });
	},
	{ deep: true }
);
const preview = async () => {
	const result = await authoring.previewDraft(draft());
	if (result && !availableCapabilities.value.length) availableCapabilities.value = result.common_capabilities;
};
const create = async () => {
	const result = await authoring.create({ ...draft(), device: { name: name.value.trim(), room_id: roomId.value, zone_ids: [] } });
	if (result) await router.push({ name: DevicesRouteNames.DEVICE, params: { id: result.device.id } });
};
const cancel = () => router.push({ name: DevicesRouteNames.DEVICES });
onBeforeMount(async () => {
	await Promise.all([devices.fetch(), spaces.fetch()]);
	await Promise.all(
		devices
			.findAll()
			.filter((device) => device.type !== 'virtual')
			.map(async (device) => {
				await channels.fetch({ deviceId: device.id });
				await Promise.all(channels.findForDevice(device.id).map((channel) => properties.fetch({ channelId: channel.id })));
			})
	);
});
</script>
