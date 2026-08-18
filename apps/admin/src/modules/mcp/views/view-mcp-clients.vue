<template>
	<view-header
		:heading="t('mcpModule.clients.title')"
		:sub-heading="t('mcpModule.clients.subtitle')"
		icon="mdi:robot-outline"
	>
		<template #extra>
			<el-button
				type="primary"
				plain
				class="px-4!"
				data-test-id="create-mcp-client"
				@click="openCreate"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>

				{{ t('mcpModule.actions.add') }}
			</el-button>
		</template>
	</view-header>

	<div class="mcp-clients-page">
		<el-alert
			type="info"
			:title="t('mcpModule.clients.securityTitle')"
			:description="t('mcpModule.clients.securityDescription')"
			:closable="false"
			show-icon
		/>

		<el-card shadow="never">
			<template #header>
				<div class="font-600">{{ t('mcpModule.config.endpoint.title') }}</div>
			</template>
			<el-input
				:model-value="endpointUrl"
				readonly
				name="endpoint"
			>
				<template #append>
					<el-button
						:aria-label="t('mcpModule.actions.copyEndpoint')"
						@click="copyEndpoint"
					>
						<icon icon="mdi:content-copy" />
					</el-button>
				</template>
			</el-input>
		</el-card>

		<el-alert
			v-if="error"
			type="error"
			:title="t('mcpModule.messages.loadFailed')"
			:closable="false"
			show-icon
		/>

		<list-mcp-clients
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="clientsPaginated"
			:total-rows="totalRows"
			:loading="loading"
			:filters-active="filtersActive"
			@edit="openEdit"
			@rotate="openRotate"
			@revoke="confirmRevoke"
			@delete="confirmDelete"
			@reset-filters="resetFilter"
			@bulk-action="onBulkAction"
		/>
	</div>

	<el-drawer
		v-model="showClientDialog"
		:show-close="false"
		:with-header="false"
		:size="isLGDevice ? '40%' : '100%'"
		:before-close="onCloseClientForm"
		data-test-id="mcp-client-form-drawer"
		@closed="resetClientForm"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #heading>
					<app-bar-heading>
						<template #icon>
							<icon icon="mdi:robot-outline" />
						</template>

						<template #title>
							<span data-test-id="drawer-heading-title">
								{{ editingClient ? t('mcpModule.clientForm.editTitle') : t('mcpModule.clientForm.createTitle') }}
							</span>
						</template>

						<template #subtitle>
							<span data-test-id="drawer-heading-subtitle">{{ t('mcpModule.clientForm.formSubtitle') }}</span>
						</template>
					</app-bar-heading>
				</template>

				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						@click="() => onCloseClientForm()"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<el-scrollbar class="grow-1 p-2 md:px-4">
				<el-form
					ref="clientFormEl"
					:model="clientForm"
					:rules="clientRules"
					label-position="top"
				>
					<el-form-item
						:label="t('mcpModule.clientForm.name')"
						prop="name"
					>
						<el-input
							v-model="clientForm.name"
							maxlength="100"
							name="clientName"
						/>
					</el-form-item>
					<el-form-item
						:label="t('mcpModule.clientForm.description')"
						prop="description"
					>
						<el-input
							v-model="clientForm.description"
							type="textarea"
							maxlength="500"
							show-word-limit
							name="clientDescription"
						/>
					</el-form-item>
					<el-form-item
						v-if="editingClient"
						:label="t('mcpModule.clientForm.enabled')"
						prop="enabled"
					>
						<el-switch
							v-model="clientForm.enabled"
							name="clientEnabled"
						/>
					</el-form-item>
					<el-form-item
						:label="t('mcpModule.clientForm.capabilities')"
						prop="capabilities"
					>
						<el-checkbox-group v-model="clientForm.capabilities">
							<el-checkbox
								v-for="capability in capabilityOptions"
								:key="capability"
								:value="capability"
								:disabled="!capabilityCeiling.includes(capability) && !clientForm.capabilities.includes(capability)"
							>
								{{ t(`mcpModule.capabilities.${capability}.title`) }}
							</el-checkbox>
						</el-checkbox-group>
						<el-alert
							class="mt-1"
							type="info"
							:description="t('mcpModule.clientForm.ceilingHint')"
							:closable="false"
							show-icon
							data-test-id="mcp-client-capability-ceiling-hint"
						/>
					</el-form-item>
					<el-form-item
						v-if="!editingClient"
						:label="t('mcpModule.clientForm.expiresInDays')"
						prop="expiresInDays"
					>
						<el-input-number
							v-model="clientForm.expiresInDays"
							:min="1"
							:max="MCP_MAX_TOKEN_EXPIRATION_DAYS"
							name="expiresInDays"
						/>
					</el-form-item>
				</el-form>
			</el-scrollbar>

			<div
				class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
				style="background-color: var(--el-drawer-bg-color)"
			>
				<div class="p-2">
					<el-button
						link
						class="mr-2"
						data-test-id="cancel-mcp-client-form"
						@click="() => onCloseClientForm()"
					>
						{{ clientFormChanged ? t('mcpModule.actions.discard') : t('mcpModule.actions.close') }}
					</el-button>

					<el-button
						type="primary"
						:loading="saving"
						:disabled="saving || !clientFormChanged"
						data-test-id="save-mcp-client-form"
						@click="saveClient"
					>
						{{ t('mcpModule.actions.save') }}
					</el-button>
				</div>
			</div>
		</div>
	</el-drawer>

	<el-dialog
		v-model="showRotateDialog"
		:title="t('mcpModule.rotate.title')"
		width="min(480px, 94vw)"
	>
		<el-alert
			type="warning"
			:description="t('mcpModule.rotate.warning')"
			:closable="false"
			show-icon
			class="mb-4"
		/>
		<el-form label-position="top">
			<el-form-item :label="t('mcpModule.clientForm.expiresInDays')">
				<el-input-number
					v-model="rotateExpiresInDays"
					:min="1"
					:max="MCP_MAX_TOKEN_EXPIRATION_DAYS"
				/>
			</el-form-item>
		</el-form>
		<template #footer>
			<el-button @click="showRotateDialog = false">{{ t('mcpModule.actions.cancel') }}</el-button>
			<el-button
				type="warning"
				:loading="saving"
				@click="confirmRotate"
			>
				{{ t('mcpModule.actions.rotate') }}
			</el-button>
		</template>
	</el-dialog>

	<mcp-token-dialog
		v-model="showTokenDialog"
		:token="oneTimeToken"
		:client-name="oneTimeClientName"
		@closed="clearOneTimeToken"
	/>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElCheckboxGroup,
	ElDialog,
	ElDrawer,
	ElForm,
	ElFormItem,
	ElIcon,
	ElInput,
	ElInputNumber,
	ElMessageBox,
	ElScrollbar,
	ElSwitch,
	type FormInstance,
	type FormRules,
} from 'element-plus';
import { isEqual } from 'lodash';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, ViewHeader, useBreakpoints, useFlashMessage } from '../../../common';
import { useConfigModule } from '../../config/composables/useConfigModule';
import ListMcpClients from '../components/list-mcp-clients.vue';
import McpTokenDialog from '../components/mcp-token-dialog.vue';
import { useMcpClients } from '../composables/useMcpClients';
import { useMcpClientsDataSource } from '../composables/useMcpClientsDataSource';
import { MCP_DEFAULT_TOKEN_EXPIRATION_DAYS, MCP_MAX_TOKEN_EXPIRATION_DAYS, MCP_MODULE_NAME, McpCapability } from '../mcp.constants';
import { isCapabilitySubset, resolveMcpEndpoint } from '../mcp.utils';
import type { IMcpClient } from '../schemas/client.types';
import type { IMcpConfigEditForm } from '../schemas/config.types';

defineOptions({ name: 'ViewMcpClients' });

const { t } = useI18n();
const flashMessage = useFlashMessage();
const { isLGDevice } = useBreakpoints();
const { clients, loading, error, fetchClients, createClient, updateClient, rotateClient, revokeClient, deleteClient } = useMcpClients();
const { clientsPaginated, totalRows, filters, filtersActive, sortBy, sortDir, paginateSize, paginatePage, resetFilter } =
	useMcpClientsDataSource(clients);
const { configModule, fetchConfigModule } = useConfigModule({ type: MCP_MODULE_NAME });

const capabilityOptions = Object.values(McpCapability);
const endpointUrl = resolveMcpEndpoint(window.location);
const capabilityCeiling = computed<McpCapability[]>(() => (configModule.value as IMcpConfigEditForm | null)?.capabilities ?? []);

const showClientDialog = ref(false);
const showRotateDialog = ref(false);
const showTokenDialog = ref(false);
const saving = ref(false);
const editingClient = ref<IMcpClient | null>(null);
const rotatingClient = ref<IMcpClient | null>(null);
const clientFormEl = ref<FormInstance>();
const rotateExpiresInDays = ref(MCP_DEFAULT_TOKEN_EXPIRATION_DAYS);
const oneTimeToken = ref('');
const oneTimeClientName = ref('');

const clientForm = reactive({
	name: '',
	description: '',
	enabled: true,
	capabilities: [] as McpCapability[],
	expiresInDays: MCP_DEFAULT_TOKEN_EXPIRATION_DAYS,
});

const clientRules = reactive<FormRules>({
	name: [{ required: true, message: t('mcpModule.clientForm.nameRequired'), trigger: 'change' }],
	expiresInDays: [{ required: true, type: 'number', min: 1, max: MCP_MAX_TOKEN_EXPIRATION_DAYS, message: t('mcpModule.clientForm.expiryRequired') }],
});

type ClientFormSnapshot = { name: string; description: string; enabled: boolean; capabilities: McpCapability[]; expiresInDays: number };

const snapshotClientForm = (): ClientFormSnapshot => ({
	name: clientForm.name,
	description: clientForm.description,
	enabled: clientForm.enabled,
	capabilities: [...clientForm.capabilities],
	expiresInDays: clientForm.expiresInDays,
});

// Taken whenever the drawer opens, so "changed" means changed since it opened
// rather than merely non-empty.
const initialClientForm = ref<ClientFormSnapshot>(snapshotClientForm());

const clientFormChanged = computed<boolean>((): boolean => !isEqual(snapshotClientForm(), initialClientForm.value));

const resetClientForm = (): void => {
	editingClient.value = null;
	clientForm.name = '';
	clientForm.description = '';
	clientForm.enabled = true;
	clientForm.capabilities = [];
	clientForm.expiresInDays = MCP_DEFAULT_TOKEN_EXPIRATION_DAYS;
	clientFormEl.value?.clearValidate();
	initialClientForm.value = snapshotClientForm();
};

/**
 * Guards every route out of the drawer — the footer action, the close button in
 * its bar, and the drawer's own `before-close` (overlay click and escape). All
 * three have to run the same check, or the edits disappear without a word.
 *
 * `done` is supplied only by `before-close`; withholding it leaves the drawer
 * open when the confirmation is dismissed.
 */
const onCloseClientForm = async (done?: () => void): Promise<void> => {
	if (clientFormChanged.value) {
		try {
			await ElMessageBox.confirm(t('mcpModule.confirm.discard'), t('mcpModule.headings.discard'), {
				confirmButtonText: t('mcpModule.actions.yes'),
				cancelButtonText: t('mcpModule.actions.no'),
				type: 'warning',
			});
		} catch {
			return;
		}
	}

	showClientDialog.value = false;

	done?.();
};

const openCreate = (): void => {
	resetClientForm();
	showClientDialog.value = true;
};

const openEdit = (client: IMcpClient): void => {
	editingClient.value = client;
	clientForm.name = client.name;
	clientForm.description = client.description ?? '';
	clientForm.enabled = client.enabled;
	clientForm.capabilities = [...client.capabilities];
	initialClientForm.value = snapshotClientForm();
	showClientDialog.value = true;
};

const showCredential = (token: string, clientName: string): void => {
	oneTimeToken.value = token;
	oneTimeClientName.value = clientName;
	showTokenDialog.value = true;
};

const clearOneTimeToken = (): void => {
	oneTimeToken.value = '';
	oneTimeClientName.value = '';
};

const saveClient = async (): Promise<void> => {
	if (!(await clientFormEl.value?.validate())) return;
	if (!isCapabilitySubset(clientForm.capabilities, capabilityCeiling.value)) {
		flashMessage.error(t('mcpModule.messages.capabilitiesOutsideCeiling'));
		return;
	}

	saving.value = true;

	try {
		if (editingClient.value) {
			await updateClient(editingClient.value.id, {
				name: clientForm.name,
				description: clientForm.description || null,
				enabled: clientForm.enabled,
				capabilities: clientForm.capabilities,
			});
			flashMessage.success(t('mcpModule.messages.updated'));
		} else {
			const credential = await createClient({
				name: clientForm.name,
				description: clientForm.description || null,
				capabilities: clientForm.capabilities,
				expiresInDays: clientForm.expiresInDays,
			});
			showCredential(credential.token, credential.client.name);
			flashMessage.success(t('mcpModule.messages.created'));
		}

		showClientDialog.value = false;
	} catch {
		flashMessage.error(t(editingClient.value ? 'mcpModule.messages.updateFailed' : 'mcpModule.messages.createFailed'));
	} finally {
		saving.value = false;
	}
};

const openRotate = (client: IMcpClient): void => {
	rotatingClient.value = client;
	rotateExpiresInDays.value = MCP_DEFAULT_TOKEN_EXPIRATION_DAYS;
	showRotateDialog.value = true;
};

const confirmRotate = async (): Promise<void> => {
	if (!rotatingClient.value) return;
	saving.value = true;

	try {
		const credential = await rotateClient(rotatingClient.value.id, { expiresInDays: rotateExpiresInDays.value });
		showRotateDialog.value = false;
		showCredential(credential.token, credential.client.name);
		flashMessage.success(t('mcpModule.messages.rotated'));
	} catch {
		flashMessage.error(t('mcpModule.messages.rotateFailed'));
	} finally {
		saving.value = false;
	}
};

const onBulkAction = async (action: string, items: IMcpClient[]): Promise<void> => {
	if (items.length === 0) {
		return;
	}

	// Destructive actions confirm once for the whole selection rather than per
	// row, matching the bulk behaviour of the other list views.
	if (action === 'revoke' || action === 'delete') {
		try {
			await ElMessageBox.confirm(
				t(action === 'revoke' ? 'mcpModule.confirm.bulkRevoke' : 'mcpModule.confirm.bulkDelete', { count: items.length }),
				t(action === 'revoke' ? 'mcpModule.actions.revoke' : 'mcpModule.actions.delete'),
				{
					type: 'warning',
					confirmButtonText: t(action === 'revoke' ? 'mcpModule.actions.revoke' : 'mcpModule.actions.delete'),
					cancelButtonText: t('mcpModule.actions.cancel'),
				}
			);
		} catch {
			return;
		}
	}

	const results = await Promise.allSettled(
		items.map((item) => {
			switch (action) {
				// The update endpoint replaces the record, so the untouched fields
				// have to be sent back alongside the flag being flipped.
				case 'enable':
					return updateClient(item.id, {
						name: item.name,
						description: item.description,
						enabled: true,
						capabilities: item.capabilities,
					});
				case 'disable':
					return updateClient(item.id, {
						name: item.name,
						description: item.description,
						enabled: false,
						capabilities: item.capabilities,
					});
				case 'revoke':
					return revokeClient(item.id);
				default:
					return deleteClient(item.id);
			}
		})
	);

	const failed = results.filter((result) => result.status === 'rejected').length;

	if (failed > 0) {
		// Partial success is reported rather than swallowed — some rows changed.
		flashMessage.error(t('mcpModule.messages.bulkFailed', { count: failed }));
	} else {
		flashMessage.success(t('mcpModule.messages.bulkSucceeded', { count: items.length }));
	}
};

const confirmRevoke = async (client: IMcpClient): Promise<void> => {
	try {
		await ElMessageBox.confirm(t('mcpModule.confirm.revoke', { name: client.name }), t('mcpModule.actions.revoke'), {
			type: 'warning',
			confirmButtonText: t('mcpModule.actions.revoke'),
			cancelButtonText: t('mcpModule.actions.cancel'),
		});
		await revokeClient(client.id);
		flashMessage.success(t('mcpModule.messages.revoked'));
	} catch (caught) {
		if (caught !== 'cancel' && caught !== 'close') flashMessage.error(t('mcpModule.messages.revokeFailed'));
	}
};

const confirmDelete = async (client: IMcpClient): Promise<void> => {
	try {
		await ElMessageBox.confirm(t('mcpModule.confirm.delete', { name: client.name }), t('mcpModule.actions.delete'), {
			type: 'error',
			confirmButtonText: t('mcpModule.actions.delete'),
			cancelButtonText: t('mcpModule.actions.cancel'),
		});
		await deleteClient(client.id);
		flashMessage.success(t('mcpModule.messages.deleted'));
	} catch (caught) {
		if (caught !== 'cancel' && caught !== 'close') flashMessage.error(t('mcpModule.messages.deleteFailed'));
	}
};

const copyEndpoint = async (): Promise<void> => {
	try {
		await navigator.clipboard.writeText(endpointUrl);
		flashMessage.success(t('mcpModule.messages.endpointCopied'));
	} catch {
		flashMessage.error(t('mcpModule.messages.copyFailed'));
	}
};

onMounted(async (): Promise<void> => {
	await Promise.allSettled([fetchClients(), fetchConfigModule()]);
});
</script>

<style scoped>
.mcp-clients-page {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 16px;
	margin: 16px;
	min-width: 0;
	overflow: hidden;
}

@media (max-width: 767px) {
	.mcp-clients-page {
		margin: 8px;
	}
}
</style>
