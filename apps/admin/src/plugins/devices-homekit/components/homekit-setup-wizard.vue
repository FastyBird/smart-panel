<template>
	<el-dialog
		:model-value="visible"
		:title="t('devicesHomeKitPlugin.wizard.title')"
		width="90vw"
		class="max-w-[860px]!"
		:close-on-click-modal="false"
		:close-on-press-escape="!isBusy"
		:show-close="!isBusy"
		:before-close="handleBeforeClose"
		@update:model-value="onDialogUpdate"
	>
		<el-steps
			:active="stepIndex"
			finish-status="success"
			align-center
			class="mb-6"
		>
			<el-step
				v-for="step in steps"
				:key="step"
				:title="t(`devicesHomeKitPlugin.wizard.steps.${step}`)"
			/>
		</el-steps>

		<div class="min-h-[360px]">
			<!-- Step 1: Device Selection -->
			<template v-if="currentStep === 'devices'">
				<el-alert
					type="info"
					:title="t('devicesHomeKitPlugin.wizard.devicesDescription')"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<el-alert
					v-if="candidatesLoadFailed"
					type="error"
					:title="t('devicesHomeKitPlugin.messages.candidatesFetchFailed')"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<div class="flex flex-wrap sm:flex-nowrap items-center gap-3 mb-4">
					<el-input
						v-model="searchQuery"
						:placeholder="t('devicesHomeKitPlugin.wizard.searchPlaceholder')"
						clearable
						class="flex-1 min-w-[240px] max-w-[380px]"
					>
						<template #prefix>
							<el-icon><icon icon="mdi:magnify" /></el-icon>
						</template>
					</el-input>

					<el-divider
						direction="vertical"
						class="hidden sm:inline-block"
					/>

					<div class="flex items-center gap-2 shrink-0">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
							{{ t('devicesHomeKitPlugin.wizard.filterDevices') }}:
						</span>

						<el-select
							v-model="filterMode"
							class="w-[180px]! shrink-0"
							style="width: 180px"
						>
							<el-option
								value="all"
								:label="t('devicesHomeKitPlugin.wizard.filterAll')"
							/>
							<el-option
								value="compatible"
								:label="t('devicesHomeKitPlugin.wizard.filterCompatibleOnly')"
							/>
						</el-select>
					</div>
				</div>

				<!-- Devices Table -->
				<div
					v-loading="store.fetchingCandidates"
					class="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden mb-4"
				>
					<el-table
						:data="filteredCandidates"
						style="width: 100%"
						max-height="360px"
						size="small"
						:empty-text="t('devicesHomeKitPlugin.wizard.noDevices')"
					>
						<el-table-column
							width="48"
							align="center"
						>
							<template #header>
								<el-checkbox
									:model-value="isAllSelected"
									:indeterminate="isIndeterminate"
									:disabled="filteredCompatibleCandidates.length === 0"
									@change="onToggleSelectAll"
								/>
							</template>
							<template #default="{ row }">
								<el-checkbox
									:model-value="selectedDeviceIds.has(row.id)"
									:disabled="!row.isCompatible && !selectedDeviceIds.has(row.id)"
									@update:model-value="(val) => onToggleDevice(row.id, Boolean(val))"
								/>
							</template>
						</el-table-column>

						<el-table-column
							:label="t('devicesHomeKitPlugin.wizard.columns.name')"
							min-width="180"
						>
							<template #default="{ row }">
								<div class="flex flex-col">
									<span class="font-medium text-gray-900 dark:text-gray-100">{{ row.name }}</span>
									<span
										v-if="row.roomName"
										class="text-xs text-gray-500"
									>
										{{ row.roomName }}
									</span>
								</div>
							</template>
						</el-table-column>

						<el-table-column
							:label="t('devicesHomeKitPlugin.wizard.columns.category')"
							width="130"
						>
							<template #default="{ row }">
								<el-tag
									size="small"
									type="info"
								>
									{{ row.category }}
								</el-tag>
							</template>
						</el-table-column>

						<el-table-column
							:label="t('devicesHomeKitPlugin.wizard.columns.homeKitService')"
							width="160"
						>
							<template #default="{ row }">
								<el-tag
									v-if="row.isCompatible"
									size="small"
									type="success"
									effect="plain"
								>
									{{ row.suggestedServiceType || t('devicesHomeKitPlugin.wizard.compatible') }}
								</el-tag>
								<el-tag
									v-else
									size="small"
									type="danger"
									effect="plain"
								>
									{{ t('devicesHomeKitPlugin.wizard.incompatible') }}
								</el-tag>
							</template>
						</el-table-column>
					</el-table>
				</div>

				<el-alert
					v-if="selectedCount > 140"
					type="warning"
					:title="t('devicesHomeKitPlugin.wizard.bridgeLimitWarning')"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<div class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
					<span class="text-sm text-gray-600 dark:text-gray-400">
						{{ t('devicesHomeKitPlugin.wizard.selectedCount', { count: selectedCount, total: totalCompatibleCount }) }}
					</span>

					<div class="flex items-center gap-2">
						<el-button
							:loading="store.savingMapping"
							:disabled="candidatesLoadFailed || store.fetchingCandidates || isBusy"
							@click="onSaveOnly"
						>
							{{ t('devicesHomeKitPlugin.wizard.buttons.saveMappings') }}
						</el-button>
						<el-button
							type="primary"
							:loading="store.savingMapping"
							:disabled="candidatesLoadFailed || store.fetchingCandidates || isBusy"
							@click="onSaveAndProceed"
						>
							{{ t('devicesHomeKitPlugin.wizard.buttons.saveAndPair') }}
						</el-button>
					</div>
				</div>
			</template>

			<!-- Step 2: Apple Home Pairing -->
			<template v-else-if="currentStep === 'pairing'">
				<el-alert
					type="info"
					:title="t('devicesHomeKitPlugin.wizard.pairingDescription')"
					:closable="false"
					show-icon
					class="mb-4!"
				/>

				<div class="flex flex-col md:flex-row items-center justify-around gap-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
					<!-- QR Code -->
					<div class="flex flex-col items-center">
						<div
							v-if="store.status?.qrCodeDataUri"
							class="p-3 bg-white rounded-lg shadow-sm border border-gray-200"
						>
							<img
								:src="store.status.qrCodeDataUri"
								alt="HomeKit QR Code"
								width="200"
								height="200"
								class="block"
							/>
						</div>
						<div
							v-else
							class="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded-lg text-gray-400"
						>
							<el-icon class="text-4xl"><icon icon="mdi:qrcode-remove" /></el-icon>
						</div>
						<span class="text-xs text-gray-500 mt-2">
							{{ t('devicesHomeKitPlugin.wizard.scanWithCamera') }}
						</span>
					</div>

					<!-- Pairing Details -->
					<div class="flex flex-col gap-4 flex-1 max-w-[320px]">
						<div>
							<div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
								{{ t('devicesHomeKitPlugin.wizard.setupCode') }}
							</div>
							<div class="flex items-center gap-2">
								<span class="text-2xl font-mono font-bold tracking-widest text-gray-900 dark:text-gray-100">
									{{ store.status?.pincode || '---' }}
								</span>
								<el-button
									size="small"
									circle
									@click="copyPinCode"
								>
									<el-icon><icon icon="mdi:content-copy" /></el-icon>
								</el-button>
							</div>
						</div>

						<div>
							<div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
								{{ t('devicesHomeKitPlugin.wizard.bridgeStatus') }}
							</div>
							<el-alert
								:type="store.status?.paired ? 'success' : 'warning'"
								:closable="false"
								show-icon
								class="w-full pairing-status-alert [&_.el-alert\_\_content]:w-full! [&_.el-alert\_\_content]:flex-1!"
							>
								<template #title>
									<div class="flex items-center justify-between gap-2 w-full">
										<span class="text-xs font-medium">
											{{
												store.status?.paired
													? t('devicesHomeKitPlugin.wizard.pairedWithCount', { count: store.status.pairedClientsCount })
													: t('devicesHomeKitPlugin.wizard.waitingForPairing')
											}}
										</span>
										<el-tooltip :content="t('devicesHomeKitPlugin.buttons.refreshStatus')">
											<el-button
												size="small"
												link
												:loading="store.fetchingStatus"
												:aria-label="t('devicesHomeKitPlugin.buttons.refreshStatus')"
												class="p-0.5! shrink-0"
												@click="refreshStatus"
											>
												<el-icon :size="16"><icon icon="mdi:refresh" /></el-icon>
											</el-button>
										</el-tooltip>
									</div>
								</template>
							</el-alert>
						</div>

						<ol class="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-decimal pl-4 m-0">
							<li>{{ t('devicesHomeKitPlugin.wizard.instruction1') }}</li>
							<li>{{ t('devicesHomeKitPlugin.wizard.instruction2') }}</li>
							<li>{{ t('devicesHomeKitPlugin.wizard.instruction3') }}</li>
						</ol>
					</div>
				</div>

				<div class="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
					<div class="flex items-center gap-2">
						<el-button
							:disabled="isBusy"
							@click="currentStep = 'devices'"
						>
							{{ t('devicesHomeKitPlugin.wizard.buttons.backToDevices') }}
						</el-button>
						<el-button
							type="danger"
							plain
							:loading="store.resettingPairing"
							:disabled="isBusy && !store.resettingPairing"
							@click="onResetPairing"
						>
							{{ t('devicesHomeKitPlugin.wizard.buttons.resetPairing') }}
						</el-button>
					</div>

					<el-button
						type="primary"
						:disabled="isBusy"
						@click="close"
					>
						{{ t('devicesHomeKitPlugin.wizard.buttons.done') }}
					</el-button>
				</div>
			</template>
		</div>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCheckbox,
	ElDialog,
	ElDivider,
	ElIcon,
	ElInput,
	ElMessageBox,
	ElOption,
	ElSelect,
	ElStep,
	ElSteps,
	ElTable,
	ElTableColumn,
	ElTag,
	ElTooltip,
	vLoading,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import { useHomeKitBridge } from '../store/homekit-bridge.store';

import type { HomeKitWizardStep, IHomeKitSetupWizardProps } from './homekit-setup-wizard.types';

defineOptions({
	name: 'HomeKitSetupWizard',
});

const props = withDefaults(defineProps<IHomeKitSetupWizardProps>(), {
	initialStep: 'devices',
});

const emit = defineEmits<{
	(e: 'update:visible', value: boolean): void;
	(e: 'completed'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const store = useHomeKitBridge();

const steps: HomeKitWizardStep[] = ['devices', 'pairing'];
const currentStep = ref<HomeKitWizardStep>(props.initialStep);

const stepIndex = computed<number>(() => steps.indexOf(currentStep.value));

const searchQuery = ref('');
const filterMode = ref<'all' | 'compatible'>('all');
const selectedDeviceIds = ref<Set<string>>(new Set());

const syncSelectionFromCandidates = (): void => {
	const initial = new Set<string>();
	for (const candidate of store.candidates) {
		if (candidate.isMapped) {
			initial.add(candidate.id);
		}
	}
	selectedDeviceIds.value = initial;
};

const filteredCandidates = computed(() => {
	const query = searchQuery.value.toLowerCase().trim();

	return store.candidates.filter((candidate) => {
		if (filterMode.value === 'compatible' && !candidate.isCompatible) {
			return false;
		}

		if (query) {
			const matchesName = candidate.name.toLowerCase().includes(query);
			const matchesRoom = candidate.roomName?.toLowerCase().includes(query);
			const matchesCategory = candidate.category.toLowerCase().includes(query);
			if (!matchesName && !matchesRoom && !matchesCategory) {
				return false;
			}
		}

		return true;
	});
});

const selectedCount = computed(() => selectedDeviceIds.value.size);
const totalCompatibleCount = computed(() => store.candidates.filter((c) => c.isCompatible).length);

const isBusy = computed<boolean>(() => Boolean(store.savingMapping || store.resettingPairing));

const candidatesLoadFailed = ref(false);

const onToggleDevice = (deviceId: string, checked: boolean): void => {
	const candidate = store.candidates.find((c) => c.id === deviceId);
	if (!candidate) return;
	if (!candidate.isCompatible && checked) return;

	const next = new Set(selectedDeviceIds.value);
	if (checked) {
		next.add(deviceId);
	} else {
		next.delete(deviceId);
	}
	selectedDeviceIds.value = next;
};

const filteredCompatibleCandidates = computed(() => filteredCandidates.value.filter((d) => d.isCompatible));

const selectedInFiltered = computed(() => filteredCompatibleCandidates.value.filter((d) => selectedDeviceIds.value.has(d.id)).length);

const isAllSelected = computed(
	() => filteredCompatibleCandidates.value.length > 0 && selectedInFiltered.value === filteredCompatibleCandidates.value.length
);

const isIndeterminate = computed(() => selectedInFiltered.value > 0 && !isAllSelected.value);

const onToggleSelectAll = (val: unknown): void => {
	const checked = Boolean(val);
	const next = new Set(selectedDeviceIds.value);
	if (checked) {
		for (const candidate of filteredCompatibleCandidates.value) {
			next.add(candidate.id);
		}
	} else {
		for (const candidate of filteredCompatibleCandidates.value) {
			next.delete(candidate.id);
		}
	}
	selectedDeviceIds.value = next;
};

const onSaveOnly = async (): Promise<void> => {
	if (candidatesLoadFailed.value || store.fetchingCandidates || isBusy.value) {
		return;
	}

	try {
		await store.mapDevices(Array.from(selectedDeviceIds.value));
		flashMessage.success(t('devicesHomeKitPlugin.messages.mappingsSaved'));
	} catch {
		flashMessage.error(t('devicesHomeKitPlugin.messages.saveMappingsFailed'));
	}
};

const onSaveAndProceed = async (): Promise<void> => {
	if (candidatesLoadFailed.value || store.fetchingCandidates || isBusy.value) {
		return;
	}

	try {
		await store.mapDevices(Array.from(selectedDeviceIds.value));
		flashMessage.success(t('devicesHomeKitPlugin.messages.mappingsSaved'));
		currentStep.value = 'pairing';
	} catch {
		flashMessage.error(t('devicesHomeKitPlugin.messages.saveMappingsFailed'));
		return;
	}

	try {
		await store.fetchStatus();
	} catch {
		flashMessage.error(t('devicesHomeKitPlugin.messages.statusFetchFailed'));
	}
};

const refreshStatus = async (): Promise<void> => {
	try {
		await store.fetchStatus();
	} catch {
		flashMessage.error(t('devicesHomeKitPlugin.messages.statusFetchFailed'));
	}
};

const copyPinCode = async (): Promise<void> => {
	if (!store.status?.pincode) return;

	try {
		await navigator.clipboard.writeText(store.status.pincode);
		flashMessage.success(t('devicesHomeKitPlugin.messages.pinCopied'));
	} catch {
		flashMessage.error(t('devicesHomeKitPlugin.messages.copyFailed'));
	}
};

const onResetPairing = async (): Promise<void> => {
	if (isBusy.value) {
		return;
	}

	try {
		await ElMessageBox.confirm(t('devicesHomeKitPlugin.messages.confirmResetPairing'), t('devicesHomeKitPlugin.headings.resetPairing'), {
			type: 'warning',
			confirmButtonText: t('devicesHomeKitPlugin.wizard.buttons.resetPairing'),
			cancelButtonText: t('devicesHomeKitPlugin.wizard.buttons.cancel'),
		});

		await store.resetPairing();
		flashMessage.success(t('devicesHomeKitPlugin.messages.pairingResetSuccess'));
	} catch (error) {
		if (error !== 'cancel') {
			flashMessage.error(t('devicesHomeKitPlugin.messages.pairingResetFailed'));
		}
	}
};

const close = (): void => {
	if (isBusy.value) {
		return;
	}
	emit('update:visible', false);
	emit('completed');
};

const handleBeforeClose = (done: () => void): void => {
	if (isBusy.value) {
		return;
	}
	done();
};

const onDialogUpdate = (value: boolean): void => {
	if (!value && !isBusy.value) {
		close();
	}
};

const loadData = async (): Promise<void> => {
	candidatesLoadFailed.value = false;
	await Promise.allSettled([
		(async () => {
			try {
				await store.fetchCandidates();
				syncSelectionFromCandidates();
			} catch {
				candidatesLoadFailed.value = true;
			}
		})(),
		store.fetchStatus().catch(() => {}),
	]);
};

watch(
	() => props.visible,
	async (isVisible) => {
		if (isVisible) {
			currentStep.value = props.initialStep;
			await loadData();
		}
	}
);

onMounted(async () => {
	if (props.visible) {
		await loadData();
	}
});
</script>

<style scoped>
:deep(.pairing-status-alert .el-alert__content) {
	width: 100%;
	flex: 1;
}
</style>
