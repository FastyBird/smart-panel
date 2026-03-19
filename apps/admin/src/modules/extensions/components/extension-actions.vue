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
											{{ t('extensionsModule.actions.labels.dangerous') }}
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
													v-if="param.description || param.required"
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
														v-if="param.description"
														class="block text-xs! font-normal"
														type="info"
													>
														{{ param.description }}
													</el-text>
												</template>

												<!-- String input -->
												<el-input
													v-if="param.type === 'string'"
													:model-value="getStringModel(action.id, param.name)"
													:placeholder="param.label"
													@update:model-value="setStringModel(action.id, param.name, $event)"
												/>

												<!-- Number input -->
												<el-input-number
													v-else-if="param.type === 'number'"
													:model-value="getNumberModel(action.id, param.name)"
													:min="param.validation?.min"
													:max="param.validation?.max"
													controls-position="right"
													class="w-full!"
													@update:model-value="setNumberModel(action.id, param.name, $event)"
												/>

												<!-- Boolean switch -->
												<el-switch
													v-else-if="param.type === 'boolean'"
													:model-value="getBooleanModel(action.id, param.name)"
													@update:model-value="setBooleanModel(action.id, param.name, Boolean($event))"
												/>

												<!-- Select -->
												<el-select
													v-else-if="param.type === 'select'"
													:model-value="getSelectModel(action.id, param.name)"
													:placeholder="param.label"
													class="w-full!"
													@update:model-value="setSelectModel(action.id, param.name, $event)"
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
													:model-value="getMultiSelectModel(action.id, param.name)"
													:placeholder="param.label"
													multiple
													class="w-full!"
													@update:model-value="setMultiSelectModel(action.id, param.name, $event)"
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
										:disabled="executingActions.has(action.id)"
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
import { computed, reactive, watch } from 'vue';
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
import { useActionsInjection } from '../composables/useActions';

defineOptions({
	name: 'ExtensionActions',
});

const props = defineProps<{
	extensionType: string;
}>();

const { t } = useI18n();
const { actions, isLoading, executingActions, executeAction } = useActionsInjection();

// Per-action form models
type FormValue = string | number | boolean | (string | number | boolean)[] | undefined;
const formModels = reactive<Record<string, Record<string, FormValue>>>({});

// Per-action result display
const actionResults = reactive<Record<string, IActionResult | undefined>>({});

const getFormModel = (actionId: string): Record<string, FormValue> => {
	if (!formModels[actionId]) {
		formModels[actionId] = {};
	}
	return formModels[actionId];
};

// Typed accessors for Element Plus v-model bindings
const getStringModel = (actionId: string, paramName: string): string | undefined => {
	return getFormModel(actionId)[paramName] as string | undefined;
};

const setStringModel = (actionId: string, paramName: string, value: string | undefined): void => {
	getFormModel(actionId)[paramName] = value;
};

const getNumberModel = (actionId: string, paramName: string): number | undefined => {
	return getFormModel(actionId)[paramName] as number | undefined;
};

const setNumberModel = (actionId: string, paramName: string, value: number | undefined): void => {
	getFormModel(actionId)[paramName] = value;
};

const getBooleanModel = (actionId: string, paramName: string): boolean => {
	const val = getFormModel(actionId)[paramName];

	return typeof val === 'boolean' ? val : false;
};

const setBooleanModel = (actionId: string, paramName: string, value: boolean): void => {
	getFormModel(actionId)[paramName] = value;
};

const getSelectModel = (actionId: string, paramName: string): string | number | boolean | undefined => {
	const val = getFormModel(actionId)[paramName];

	return Array.isArray(val) ? undefined : val;
};

const setSelectModel = (actionId: string, paramName: string, value: string | number | boolean | undefined): void => {
	getFormModel(actionId)[paramName] = value;
};

const getMultiSelectModel = (actionId: string, paramName: string): (string | number | boolean)[] => {
	const val = getFormModel(actionId)[paramName];

	return Array.isArray(val) ? val : [];
};

const setMultiSelectModel = (actionId: string, paramName: string, value: (string | number | boolean)[]): void => {
	getFormModel(actionId)[paramName] = value;
};

// Initialize form defaults when actions are loaded, clearing stale entries
const initFormDefaults = (): void => {
	const currentActionIds = new Set(actions.value.map((a) => a.id));

	// Remove stale entries for actions that no longer exist
	for (const key of Object.keys(formModels)) {
		if (!currentActionIds.has(key)) {
			delete formModels[key];
		}
	}

	for (const key of Object.keys(actionResults)) {
		if (!currentActionIds.has(key)) {
			delete actionResults[key];
		}
	}

	// Initialize defaults for current actions from scratch
	for (const action of actions.value) {
		formModels[action.id] = {};

		for (const param of action.parameters ?? []) {
			if (param.default !== undefined) {
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

// Initialize form defaults when actions change (parent manages fetching via shared useActions instance)
watch(actions, () => {
	initFormDefaults();
}, { immediate: true });
</script>
