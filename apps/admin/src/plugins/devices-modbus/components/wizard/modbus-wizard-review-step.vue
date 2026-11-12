<template>
	<div class="flex flex-col gap-4">
		<el-alert
			v-if="wizard.createError.value !== null"
			type="error"
			:title="editing ? t('devicesModbusPlugin.wizard.edit.saveFailed') : t('devicesModbusPlugin.wizard.review.failed')"
			:description="wizard.createError.value"
			:closable="false"
			show-icon
			data-test-id="review-error"
		/>

		<el-descriptions
			:column="1"
			border
		>
			<el-descriptions-item :label="t('devicesModbusPlugin.wizard.review.endpoint')">
				<span data-test-id="review-endpoint">{{ endpointText }}</span>
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModbusPlugin.wizard.review.unitId')">
				{{ wizard.state.unitId }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModbusPlugin.wizard.review.name')">
				{{ wizard.state.device.name.trim() }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModbusPlugin.wizard.review.category')">
				{{ wizard.state.device.category }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModbusPlugin.wizard.review.room')">
				{{ roomName ?? t('devicesModbusPlugin.wizard.review.noRoom') }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModbusPlugin.wizard.review.pollInterval')">
				{{ wizard.state.device.pollIntervalMs }} ms
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModbusPlugin.wizard.review.orders')">
				{{ wizard.state.device.byteOrder }} / {{ wizard.state.device.wordOrder }}
			</el-descriptions-item>
			<el-descriptions-item
				v-if="!editing"
				:label="t('devicesModbusPlugin.wizard.review.source')"
			>
				<span data-test-id="review-source">{{ sourceText }}</span>
			</el-descriptions-item>
		</el-descriptions>

		<div
			v-for="channel in channels"
			:key="channel.identifier"
			data-test-id="review-channel"
		>
			<div class="font-bold mb-1">{{ channel.name }}</div>
			<ul class="list-none p-0 m-0 flex flex-col gap-1 text-sm">
				<li
					v-for="line in channel.lines"
					:key="line.key"
					data-test-id="review-binding"
				>
					<span class="font-mono">{{ line.property }}</span>
					<span class="text-gray-500">{{ line.direction }}:</span>
					<span>{{ line.text }}</span>
				</li>
			</ul>
		</div>

		<div class="flex justify-end">
			<el-button
				type="primary"
				:disabled="!canCreate"
				:loading="wizard.submitState.value === 'submitting'"
				data-test-id="review-create"
				@click="onCreate"
			>
				{{ editing ? t('devicesModbusPlugin.wizard.edit.save') : t('devicesModbusPlugin.wizard.review.create') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElAlert, ElButton, ElDescriptions, ElDescriptionsItem } from 'element-plus';

import { injectStoresManager, useFlashMessage, useLogger } from '../../../../common';
import { RouteNames as DevicesRouteNames } from '../../../../modules/devices';
import { devicesStoreKey } from '../../../../modules/devices/store/keys';
import { spacesStoreKey } from '../../../../modules/spaces/store/keys';
import { formatAddress } from '../../lib/address-notation';
import { type ModbusPoint, type ModbusPointBinding, samePoints } from '../../lib/points';
import { modbusEndpointsStoreKey } from '../../store/keys';

import type { IModbusWizardReviewStepProps } from './modbus-wizard-review-step.types';

defineOptions({
	name: 'ModbusWizardReviewStep',
});

const props = defineProps<IModbusWizardReviewStepProps>();

const { t } = useI18n();
const logger = useLogger();
const router = useRouter();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();

const devicesStore = storesManager.getStore(devicesStoreKey);
const endpointsStore = storesManager.getStore(modbusEndpointsStoreKey);
const spacesStore = storesManager.getStore(spacesStoreKey);

const wizard = props.wizard;

const editing = computed<boolean>((): boolean => wizard.mode.value === 'edit');

const endpointText = computed<string>((): string => {
	const endpoint = wizard.state.endpointId !== null ? endpointsStore.findById(wizard.state.endpointId) : null;

	return endpoint ? `${endpoint.name} (${endpoint.host}:${endpoint.port}, ${endpoint.framing})` : (wizard.state.endpointId ?? '');
});

const roomName = computed<string | null>((): string | null =>
	wizard.state.device.roomId !== null ? (spacesStore.findById(wizard.state.device.roomId)?.name ?? null) : null
);

const sourceText = computed<string>((): string => {
	const template = wizard.state.template;

	return template !== null && samePoints(wizard.state.points, template.points)
		? t('devicesModbusPlugin.wizard.review.fromTemplate', { id: template.id, revision: template.revision })
		: t('devicesModbusPlugin.wizard.review.custom');
});

const describeBinding = (binding: ModbusPointBinding): string => {
	const parts = [
		`${binding.registerType} ${formatAddress(binding.address, binding.registerType, wizard.state.notation)} (PDU ${binding.address})`,
		binding.dataType,
	];

	if (binding.bit !== null) {
		parts.push(`bit ${binding.bit}`);
	}

	if (binding.valueMap !== null) {
		parts.push(binding.valueMap.map((entry) => `${entry.raw}=${String(entry.value)}`).join(', '));
	} else if (binding.scale !== 1 || binding.offset !== 0) {
		parts.push(`x${binding.scale} +${binding.offset}`);
	}

	if (binding.invert) {
		parts.push(t('devicesModbusPlugin.wizard.review.inverted'));
	}

	return parts.join(', ');
};

interface IReviewChannel {
	identifier: string;
	name: string;
	lines: { key: string; property: string; direction: string; text: string }[];
}

const channels = computed<IReviewChannel[]>((): IReviewChannel[] => {
	const grouped = new Map<string, IReviewChannel>();

	for (const point of wizard.state.points as ModbusPoint[]) {
		const channel = grouped.get(point.channelIdentifier) ?? { identifier: point.channelIdentifier, name: point.name, lines: [] };

		for (const [direction, binding] of [
			['read', point.read],
			['write', point.write],
		] as const) {
			if (binding !== null) {
				channel.lines.push({
					key: `${point.key}-${direction}`,
					property: point.propertyCategory,
					direction: t(`devicesModbusPlugin.wizard.review.${direction}`),
					text: describeBinding(binding),
				});
			}
		}

		grouped.set(point.channelIdentifier, channel);
	}

	return [...grouped.values()];
});

// Create stays disabled while a request is pending and once the device exists or its points are saved, so it can
// never be submitted twice.
const canCreate = computed<boolean>(
	(): boolean =>
		wizard.submitState.value !== 'submitting' &&
		wizard.submitState.value !== 'created' &&
		wizard.submitState.value !== 'saved' &&
		wizard.canContinue(3) &&
		wizard.canContinue(2)
);

const onCreate = async (): Promise<void> => {
	if (!canCreate.value) {
		return;
	}

	let id: string;

	try {
		id = await wizard.submit();
	} catch (error: unknown) {
		logger.error(editing.value ? 'Failed to update the Modbus device points' : 'Failed to create the Modbus device', error);

		return;
	}

	if (editing.value) {
		// The wizard refreshed the device, its channels and properties after the update.
		flashMessage.success(t('devicesModbusPlugin.wizard.edit.saved', { name: wizard.state.device.name.trim() }));

		await router.push({ name: DevicesRouteNames.DEVICE, params: { id } });

		return;
	}

	// Warms the cache so the detail view shows the new device without a refresh; the device exists either way.
	try {
		await devicesStore.get({ id });
	} catch (error: unknown) {
		logger.error('Failed to refresh the created device', error);
	}

	flashMessage.success(t('devicesModbusPlugin.wizard.review.created', { name: wizard.state.device.name.trim() }));

	await router.push({ name: DevicesRouteNames.DEVICE, params: { id } });
};

defineExpose({ canCreate, onCreate });
</script>
