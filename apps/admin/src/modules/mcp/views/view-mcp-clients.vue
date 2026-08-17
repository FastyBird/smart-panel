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

				{{ t('mcpModule.actions.create') }}
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

		<div class="mcp-client-table-wrap">
			<el-table
				v-loading="loading"
				:data="clients"
				class="mcp-client-table"
				row-key="id"
			>
				<el-table-column
					prop="name"
					:label="t('mcpModule.clients.columns.name')"
					min-width="190"
				>
					<template #default="scope">
						<div class="font-600">{{ scope.row.name }}</div>
						<div class="text-sm text-gray-500">{{ scope.row.description || t('mcpModule.clients.noDescription') }}</div>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('mcpModule.clients.columns.status')"
					width="120"
				>
					<template #default="scope">
						<el-tag :type="status(scope.row).type">
							{{ t(`mcpModule.status.${status(scope.row).key}`) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('mcpModule.clients.columns.capabilities')"
					min-width="210"
				>
					<template #default="scope">
						<div class="flex flex-wrap gap-1">
							<el-tag
								v-for="capability in scope.row.capabilities"
								:key="capability"
								type="info"
							>
								{{ t(`mcpModule.capabilities.${capability}.title`) }}
							</el-tag>
							<span v-if="scope.row.capabilities.length === 0">{{ t('mcpModule.clients.none') }}</span>
						</div>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('mcpModule.clients.columns.expires')"
					width="180"
				>
					<template #default="scope">
						{{ formatNullableDate(scope.row.credentialExpiresAt) }}
					</template>
				</el-table-column>
				<el-table-column
					:label="t('mcpModule.clients.columns.lastUsed')"
					width="180"
				>
					<template #default="scope">
						{{ formatNullableDate(scope.row.lastUsedAt) }}
					</template>
				</el-table-column>
				<el-table-column
					fixed="right"
					:label="t('mcpModule.clients.columns.actions')"
					width="250"
				>
					<template #default="scope">
						<mcp-client-actions
							:client="scope.row"
							@edit="openEdit"
							@rotate="openRotate"
							@revoke="confirmRevoke"
							@delete="confirmDelete"
						/>
					</template>
				</el-table-column>
				<template #empty>
					{{ t('mcpModule.clients.empty') }}
				</template>
			</el-table>
		</div>

		<div
			v-loading="loading"
			class="mcp-client-cards"
		>
			<el-card
				v-for="cardClient in clients"
				:key="cardClient.id"
				shadow="never"
			>
				<div class="flex justify-between gap-2 mb-2">
					<div>
						<div class="font-600">{{ cardClient.name }}</div>
						<div class="text-sm text-gray-500">{{ cardClient.description || t('mcpModule.clients.noDescription') }}</div>
					</div>
					<el-tag :type="status(cardClient).type">{{ t(`mcpModule.status.${status(cardClient).key}`) }}</el-tag>
				</div>
				<div class="flex flex-wrap gap-1 mb-3">
					<el-tag
						v-for="capability in cardClient.capabilities"
						:key="capability"
						type="info"
					>
						{{ t(`mcpModule.capabilities.${capability}.title`) }}
					</el-tag>
				</div>
				<div class="text-sm mb-1">{{ t('mcpModule.clients.columns.expires') }}: {{ formatNullableDate(cardClient.credentialExpiresAt) }}</div>
				<div class="text-sm mb-3">{{ t('mcpModule.clients.columns.lastUsed') }}: {{ formatNullableDate(cardClient.lastUsedAt) }}</div>
				<mcp-client-actions
					:client="cardClient"
					@edit="openEdit"
					@rotate="openRotate"
					@revoke="confirmRevoke"
					@delete="confirmDelete"
				/>
			</el-card>
			<div
				v-if="!loading && clients.length === 0"
				class="text-center text-gray-500 py-6"
			>
				{{ t('mcpModule.clients.empty') }}
			</div>
		</div>
	</div>

	<el-dialog
		v-model="showClientDialog"
		:title="editingClient ? t('mcpModule.clientForm.editTitle') : t('mcpModule.clientForm.createTitle')"
		width="min(620px, 94vw)"
		@closed="resetClientForm"
	>
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
				<div class="text-sm text-gray-500 mt-1">{{ t('mcpModule.clientForm.ceilingHint') }}</div>
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
		<template #footer>
			<el-button @click="showClientDialog = false">{{ t('mcpModule.actions.cancel') }}</el-button>
			<el-button
				type="primary"
				:loading="saving"
				@click="saveClient"
			>
				{{ editingClient ? t('mcpModule.actions.save') : t('mcpModule.actions.create') }}
			</el-button>
		</template>
	</el-dialog>

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
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElMessageBox,
	ElSwitch,
	ElTable,
	ElTableColumn,
	ElTag,
	type FormInstance,
	type FormRules,
	vLoading,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { ViewHeader, useFlashMessage } from '../../../common';
import { useConfigModule } from '../../config/composables/useConfigModule';
import McpClientActions from '../components/mcp-client-actions.vue';
import McpTokenDialog from '../components/mcp-token-dialog.vue';
import { useMcpClients } from '../composables/useMcpClients';
import { MCP_DEFAULT_TOKEN_EXPIRATION_DAYS, MCP_MAX_TOKEN_EXPIRATION_DAYS, MCP_MODULE_NAME, McpCapability } from '../mcp.constants';
import { isCapabilitySubset, resolveMcpEndpoint } from '../mcp.utils';
import type { IMcpClient } from '../schemas/client.types';
import type { IMcpConfigEditForm } from '../schemas/config.types';

defineOptions({ name: 'ViewMcpClients' });

const { t } = useI18n();
const flashMessage = useFlashMessage();
const { clients, loading, error, fetchClients, createClient, updateClient, rotateClient, revokeClient, deleteClient } = useMcpClients();
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

const resetClientForm = (): void => {
	editingClient.value = null;
	clientForm.name = '';
	clientForm.description = '';
	clientForm.enabled = true;
	clientForm.capabilities = [];
	clientForm.expiresInDays = MCP_DEFAULT_TOKEN_EXPIRATION_DAYS;
	clientFormEl.value?.clearValidate();
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

const status = (client: IMcpClient): { key: string; type: 'success' | 'warning' | 'danger' | 'info' } => {
	if (client.credentialRevoked) return { key: 'revoked', type: 'danger' };
	if (client.credentialExpiresAt && new Date(client.credentialExpiresAt).getTime() <= Date.now()) return { key: 'expired', type: 'danger' };
	if (!client.enabled) return { key: 'disabled', type: 'warning' };
	return { key: 'active', type: 'success' };
};

const formatNullableDate = (value: string | null): string =>
	value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : t('mcpModule.clients.never');

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
}

.mcp-client-table-wrap {
	overflow-x: auto;
}

.mcp-client-table {
	min-width: 1050px;
}

.mcp-client-cards {
	display: none;
	flex-direction: column;
	gap: 12px;
}

@media (max-width: 767px) {
	.mcp-clients-page {
		margin: 8px;
	}

	.mcp-client-table-wrap {
		display: none;
	}

	.mcp-client-cards {
		display: flex;
	}
}
</style>
