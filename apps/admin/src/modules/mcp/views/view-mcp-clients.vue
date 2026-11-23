<template>
	<view-header
		:title="t('mcpModule.clients.title')"
		:subtitle="t('mcpModule.clients.subtitle')"
		:icon="MCP_CLIENT_ICON"
		:actions="[
			{ icon: 'mdi:magnify', label: t('mcpModule.clients.searchPlaceholder'), handler: onSearch },
			{ icon: 'mdi:plus', label: t('mcpModule.actions.add'), handler: openCreate },
		]"
	>
		<template #actions>
			<el-button
				type="primary"
				plain
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

	<div class="page-pad flex flex-col flex-1 min-h-0 box-border">
		<!-- Template 4: add and edit open next to the list. The form has no route of its own, so on phone it takes a
		     full-width drawer -->
		<edit-drawer-layout
			:open="showClientDialog"
			:before-close="onCloseClientForm"
			routeless
			@close="onCloseClientForm()"
		>
			<div class="flex flex-col gap-4 flex-1 min-h-0">
				<section
					class="flex flex-col gap-3 shrink-0 p-4 tp:p-5 bg-surface border border-solid border-light rounded-lg"
					data-test-id="mcp-endpoint"
				>
					<copy-field
						:value="endpointUrl"
						:label="t('mcpModule.config.endpoint.title')"
						data-test-id="mcp-endpoint-url"
					/>
					<p class="flex items-start gap-2 m-0 text-help">
						<icon
							icon="mdi:shield-lock-outline"
							width="16"
							height="16"
							class="shrink-0 mt-[3px]"
							aria-hidden="true"
						/>
						<span>
							<span class="text-label">{{ t('mcpModule.clients.securityTitle') }}.</span>
							{{ t('mcpModule.clients.securityDescription') }}
						</span>
					</p>
				</section>

				<list-mcp-clients
					ref="list"
					v-model:filters="filters"
					v-model:sort-by="sortBy"
					v-model:sort-dir="sortDir"
					v-model:paginate-size="paginateSize"
					v-model:paginate-page="paginatePage"
					:items="clientsPaginated"
					:total-rows="totalRows"
					:loading="loading"
					:load-failed="error !== null"
					:filters-active="filtersActive"
					@edit="openEdit"
					@rotate="openRotate"
					@revoke="confirmRevoke"
					@delete="confirmDelete"
					@reset-filters="resetFilter"
					@retry="fetchClients"
					@bulk-action="onBulkAction"
				/>
			</div>

			<template #form>
				<view-header
					:title="editingClient ? t('mcpModule.clientForm.editTitle') : t('mcpModule.clientForm.createTitle')"
					:subtitle="t('mcpModule.clientForm.formSubtitle')"
					:icon="editingClient ? 'mdi:pencil' : 'mdi:plus'"
				/>

				<el-scrollbar class="grow-1 p-2 tp:px-4">
					<el-form
						ref="clientFormEl"
						:model="clientForm"
						:rules="clientRules"
						label-position="top"
						data-test-id="mcp-client-form"
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
							<div class="flex flex-col gap-1 w-full">
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
								<span
									class="text-help"
									data-test-id="mcp-client-capability-ceiling-hint"
								>
									{{ t('mcpModule.clientForm.ceilingHint') }}
								</span>
							</div>
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

				<form-footer
					:dirty="clientFormChanged"
					:saving="saving"
					:can-save="clientFormChanged && !saving"
					:save-label="editingClient ? undefined : t('mcpModule.actions.create')"
					@save="saveClient"
					@discard="onCloseClientForm()"
					@close="onCloseClientForm()"
				/>
			</template>
		</edit-drawer-layout>
	</div>

	<el-dialog
		v-model="showRotateDialog"
		:title="t('mcpModule.rotate.title')"
		width="min(480px, calc(100vw - 32px))"
	>
		<div class="flex flex-col gap-4">
			<el-alert
				type="warning"
				:description="t('mcpModule.rotate.warning')"
				:closable="false"
				show-icon
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
		</div>
		<template #footer>
			<el-button @click="showRotateDialog = false">{{ t('mcpModule.actions.cancel') }}</el-button>
			<el-button
				type="primary"
				:loading="saving"
				data-test-id="confirm-rotate-mcp-client"
				@click="confirmRotate"
			>
				{{ t('mcpModule.rotate.title') }}
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
	ElCheckbox,
	ElCheckboxGroup,
	ElDialog,
	ElForm,
	ElFormItem,
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

import { CopyField, EditDrawerLayout, FormFooter, ViewHeader, provideEditDrawer, useFlashMessage } from '../../../common';
import { useConfigModule } from '../../config/composables/useConfigModule';
import ListMcpClients from '../components/list-mcp-clients.vue';
import McpTokenDialog from '../components/mcp-token-dialog.vue';
import { useMcpClients } from '../composables/useMcpClients';
import { useMcpClientsDataSource } from '../composables/useMcpClientsDataSource';
import { MCP_CLIENT_ICON, MCP_DEFAULT_TOKEN_EXPIRATION_DAYS, MCP_MAX_TOKEN_EXPIRATION_DAYS, MCP_MODULE_NAME, McpCapability } from '../mcp.constants';
import { isCapabilitySubset, resolveMcpEndpoint } from '../mcp.utils';
import type { IMcpClient } from '../schemas/client.types';
import type { IMcpConfigEditForm } from '../schemas/config.types';

defineOptions({ name: 'ViewMcpClients' });

const { t } = useI18n();
const flashMessage = useFlashMessage();
const { clients, loading, error, fetchClients, createClient, updateClient, rotateClient, revokeClient, deleteClient } = useMcpClients();
const { clientsPaginated, totalRows, filters, filtersActive, sortBy, sortDir, paginateSize, paginatePage, resetFilter } =
	useMcpClientsDataSource(clients);
const { configModule, fetchConfigModule } = useConfigModule({ type: MCP_MODULE_NAME });

const capabilityOptions = Object.values(McpCapability);
const endpointUrl = resolveMcpEndpoint(window.location);
const capabilityCeiling = computed<McpCapability[]>(() => (configModule.value as IMcpConfigEditForm | null)?.capabilities ?? []);

const showClientDialog = ref(false);

// The form keeps the layout it opened in, so a window crossing a size class does not remount it
provideEditDrawer((): boolean => showClientDialog.value);

const list = ref<InstanceType<typeof ListMcpClients> | null>(null);

// The phone app bar's Search action moves focus to the search field
const onSearch = (): void => {
	list.value?.focusSearch();
};
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
// Resolves true when the form may be replaced or closed: nothing was edited, or the user agreed to discard
const confirmDiscard = async (): Promise<boolean> => {
	if (!clientFormChanged.value) {
		return true;
	}

	try {
		await ElMessageBox.confirm(t('mcpModule.confirm.discard'), t('mcpModule.headings.discard'), {
			confirmButtonText: t('mcpModule.actions.yes'),
			cancelButtonText: t('mcpModule.actions.no'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

const onCloseClientForm = async (done?: () => void): Promise<void> => {
	if (!(await confirmDiscard())) {
		return;
	}

	showClientDialog.value = false;

	done?.();
};

// On wide screens the form docks beside the list without a scrim, so the list stays usable while the form is open:
// opening another client or a new one replaces the form and has to run the same guard as closing it
const openCreate = async (): Promise<void> => {
	if (showClientDialog.value && !(await confirmDiscard())) {
		return;
	}

	resetClientForm();
	showClientDialog.value = true;
};

const openEdit = async (client: IMcpClient): Promise<void> => {
	if (showClientDialog.value && !(await confirmDiscard())) {
		return;
	}

	editingClient.value = client;
	clientForm.name = client.name;
	clientForm.description = client.description ?? '';
	clientForm.enabled = client.enabled;
	clientForm.capabilities = [...client.capabilities];
	clientFormEl.value?.clearValidate();
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
					// The button repeats the verb and the object, "Delete 3 clients" (spec section 4)
					confirmButtonText: t(action === 'revoke' ? 'mcpModule.confirm.bulkRevokeButton' : 'mcpModule.confirm.bulkDeleteButton', {
						count: items.length,
					}),
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

onMounted(async (): Promise<void> => {
	await Promise.allSettled([fetchClients(), fetchConfigModule()]);
});
</script>
