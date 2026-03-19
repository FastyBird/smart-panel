<template>
	<div class="p-4">
		<el-skeleton
			v-if="isLoading"
			:rows="4"
			animated
		/>

		<el-empty
			v-else-if="actions.length === 0"
			:description="t('extensionsModule.actions.messages.noActions')"
		/>

		<template v-else>
			<template
				v-for="category in groupedActions"
				:key="category.name"
			>
				<div class="mb-4">
					<h4 class="text-sm font-semibold uppercase tracking-wide mb-2 text-gray-500">
						{{ t(`extensionsModule.actions.labels.category.${category.name}`) }}
					</h4>

					<div class="grid grid-cols-1 gap-3">
						<el-card
							v-for="action in category.actions"
							:key="action.id"
							shadow="hover"
							body-class="p-4!"
						>
							<div class="flex items-start gap-3">
								<div
									v-if="action.icon"
									class="shrink-0 mt-1"
								>
									<icon
										:icon="action.icon"
										class="w-6 h-6 text-gray-500"
									/>
								</div>

								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<span class="font-medium">{{ action.label }}</span>
										<el-tag
											v-if="action.mode === 'interactive'"
											size="small"
											type="info"
										>
											{{ t('extensionsModule.actions.labels.comingSoon') }}
										</el-tag>
										<el-tag
											v-if="action.dangerous"
											size="small"
											type="danger"
										>
											{{ t('extensionsModule.labels.status') }}
										</el-tag>
									</div>

									<p
										v-if="action.description"
										class="text-sm text-gray-500 m-0 mb-3"
									>
										{{ action.description }}
									</p>

									<!-- Parameter form for immediate actions -->
									<template v-if="action.mode === 'immediate' && action.parameters?.length">
										<el-form
											:model="getFormModel(action.id)"
											label-position="top"
											class="mb-3"
											size="small"
										>
											<el-form-item
												v-for="param in action.parameters"
												:key="param.name"
												:label="param.label"
												class="mb-2!"
											>
												<template
													v-if="param.description"
													#label
												>
													<span>{{ param.label }}</span>
													<el-text
														v-if="param.required"
														type="danger"
														class="ml-1"
													>
														*
													</el-text>
													<el-text
														class="block text-xs! font-normal"
														type="info"
													>
														{{ param.description }}
													</el-text>
												</template>

												<!-- String input -->
												<el-input
													v-if="param.type === 'string'"
													v-model="getFormModel(action.id)[param.name]"
													:placeholder="param.label"
												/>

												<!-- Number input -->
												<el-input-number
													v-else-if="param.type === 'number'"
													v-model="getFormModel(action.id)[param.name]"
													:min="param.validation?.min"
													:max="param.validation?.max"
													controls-position="right"
													class="w-full!"
												/>

												<!-- Boolean switch -->
												<el-switch
													v-else-if="param.type === 'boolean'"
													v-model="getFormModel(action.id)[param.name]"
												/>

												<!-- Select -->
												<el-select
													v-else-if="param.type === 'select'"
													v-model="getFormModel(action.id)[param.name]"
													:placeholder="param.label"
													class="w-full!"
												>
													<el-option
														v-for="opt in param.options"
														:key="String(opt.value)"
														:label="opt.label"
														:value="opt.value"
													/>
												</el-select>

												<!-- Multi-select -->
												<el-select
													v-else-if="param.type === 'multi_select'"
													v-model="getFormModel(action.id)[param.name]"
													:placeholder="param.label"
													multiple
													class="w-full!"
												>
													<el-option
														v-for="opt in param.options"
														:key="String(opt.value)"
														:label="opt.label"
														:value="opt.value"
													/>
												</el-select>
											</el-form-item>
										</el-form>
									</template>

									<!-- Result display -->
									<el-alert
										v-if="actionResults[action.id]"
										:type="actionResults[action.id]!.success ? 'success' : 'error'"
										:title="actionResults[action.id]!.message || (actionResults[action.id]!.success ? t('extensionsModule.actions.messages.success') : t('extensionsModule.actions.messages.error'))"
										show-icon
										closable
										class="mb-2"
										@close="delete actionResults[action.id]"
									/>
								</div>

								<div class="shrink-0">
									<el-button
										v-if="action.mode === 'immediate'"
										type="primary"
										:loading="executingActions.has(action.id)"
										:disabled="action.mode !== 'immediate'"
										@click="onExecute(action)"
									>
										<template #icon>
											<icon icon="mdi:play" />
										</template>
										{{ t('extensionsModule.actions.buttons.run') }}
									</el-button>

									<el-tooltip
										v-else
										:content="t('extensionsModule.actions.messages.interactiveNotAvailable')"
									>
										<el-button disabled>
											<template #icon>
												<icon icon="mdi:console" />
											</template>
											{{ t('extensionsModule.actions.buttons.run') }}
										</el-button>
									</el-tooltip>
								</div>
							</div>
						</el-card>
					</div>
				</div>
			</template>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElEmpty,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElOption,
	ElSelect,
	ElSkeleton,
	ElSwitch,
	ElTag,
	ElText,
	ElTooltip,
	ElMessageBox,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IActionResult, IExtensionActionDescriptor } from '../composables/useActions';
import { useActions } from '../composables/useActions';

defineOptions({
	name: 'ExtensionActions',
});

const props = defineProps<{
	extensionType: string;
}>();

const { t } = useI18n();
const { actions, isLoading, executingActions, fetchActions, executeAction } = useActions();

// Per-action form models
const formModels = reactive<Record<string, Record<string, unknown>>>({});

// Per-action result display
const actionResults = reactive<Record<string, IActionResult | undefined>>({});

const getFormModel = (actionId: string): Record<string, unknown> => {
	if (!formModels[actionId]) {
		formModels[actionId] = {};
	}
	return formModels[actionId];
};

// Initialize form defaults when actions are loaded
const initFormDefaults = (): void => {
	for (const action of actions.value) {
		if (!formModels[action.id]) {
			formModels[action.id] = {};
		}

		for (const param of action.parameters ?? []) {
			if (param.default !== undefined && formModels[action.id][param.name] === undefined) {
				formModels[action.id][param.name] = param.default;
			}
		}
	}
};

// Group actions by category
const groupedActions = computed(() => {
	const groups: Record<string, IExtensionActionDescriptor[]> = {};

	for (const action of actions.value) {
		const category = action.category ?? 'general';

		if (!groups[category]) {
			groups[category] = [];
		}

		groups[category].push(action);
	}

	return Object.entries(groups).map(([name, groupActions]) => ({
		name,
		actions: groupActions,
	}));
});

const onExecute = async (action: IExtensionActionDescriptor): Promise<void> => {
	// Confirm dangerous actions
	if (action.dangerous) {
		try {
			await ElMessageBox.confirm(
				t('extensionsModule.actions.messages.confirmDangerous'),
				action.label,
				{
					confirmButtonText: t('extensionsModule.actions.buttons.confirm'),
					cancelButtonText: t('extensionsModule.actions.buttons.cancel'),
					type: 'warning',
				},
			);
		} catch {
			return; // User canceled
		}
	}

	// Clear previous result
	delete actionResults[action.id];

	const params = formModels[action.id] ?? {};
	const result = await executeAction(props.extensionType, action.id, params);

	actionResults[action.id] = result;
};

watch(
	() => props.extensionType,
	() => {
		fetchActions(props.extensionType).then(() => initFormDefaults());
	},
);

watch(actions, () => {
	initFormDefaults();
});

onMounted(() => {
	fetchActions(props.extensionType).then(() => initFormDefaults());
});
</script>
