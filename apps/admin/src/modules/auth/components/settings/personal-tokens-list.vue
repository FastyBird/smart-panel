<template>
	<div>
		<el-alert
			:title="t('authModule.tokens.description', 'Personal access tokens allow external applications to authenticate with the API on your behalf.')"
			type="info"
			:closable="false"
			class="m-4"
		/>

		<div
			v-loading="loading"
			class="min-h-[100px]"
		>
			<el-table
				:data="tokens"
				class="w-full"
				table-layout="fixed"
			>
				<template #empty>
					<div
						v-if="loading"
						class="h-full w-full leading-normal"
					>
						<el-result class="h-full w-full">
							<template #icon>
								<icon-with-child :size="80">
									<template #primary>
										<icon icon="mdi:key" />
									</template>
									<template #secondary>
										<icon icon="mdi:database-refresh" />
									</template>
								</icon-with-child>
							</template>
						</el-result>
					</div>

					<div
						v-else
						class="h-full w-full leading-normal"
					>
						<el-result class="h-full w-full">
							<template #icon>
								<icon-with-child :size="80">
									<template #primary>
										<icon icon="mdi:key" />
									</template>
									<template #secondary>
										<icon icon="mdi:information" />
									</template>
								</icon-with-child>
							</template>

							<template #title>
								{{ t('authModule.tokens.noTokens', 'No personal access tokens yet.') }}
							</template>
						</el-result>
					</div>
				</template>

				<el-table-column
					:label="t('authModule.tokens.columns.name', 'Name')"
					prop="name"
					min-width="150"
				>
					<template #default="{ row }">
						<div>
							<strong class="block">{{ row.name }}</strong>
							<el-text
								v-if="row.description"
								size="small"
								type="info"
								class="block leading-4"
								truncated
							>
								{{ row.description }}
							</el-text>
						</div>
					</template>
				</el-table-column>

				<el-table-column
					:label="t('authModule.tokens.columns.created', 'Created')"
					prop="created_at"
					width="180"
				>
					<template #default="{ row }">
						{{ formatDate(row.created_at) }}
					</template>
				</el-table-column>

				<el-table-column
					:label="t('authModule.tokens.columns.lastUsed', 'Last Used')"
					prop="last_used_at"
					width="180"
				>
					<template #default="{ row }">
						{{ row.last_used_at ? formatDate(row.last_used_at) : t('authModule.tokens.never', 'Never') }}
					</template>
				</el-table-column>

				<el-table-column
					:label="t('authModule.tokens.columns.expires', 'Expires')"
					prop="expires_at"
					width="180"
				>
					<template #default="{ row }">
						<template v-if="row.expires_at">
							<el-text :type="isExpired(row.expires_at) ? 'danger' : undefined">
								{{ formatDate(row.expires_at) }}
							</el-text>
						</template>
						<template v-else>
							{{ t('authModule.tokens.never', 'Never') }}
						</template>
					</template>
				</el-table-column>

				<el-table-column
					:label="t('authModule.tokens.columns.actions', 'Actions')"
					width="120"
					align="right"
				>
					<template #default="{ row }">
						<div @click.stop>
							<el-button
								size="small"
								type="danger"
								plain
								:loading="revokingTokenId === row.id"
								@click="onRevokeToken(row)"
							>
								<template #icon>
									<icon icon="mdi:key-remove" />
								</template>
								{{ t('authModule.tokens.revoke', 'Revoke') }}
							</el-button>
						</div>
					</template>
				</el-table-column>
			</el-table>
		</div>

		<!-- Create Token Dialog -->
		<el-dialog
			v-model="showCreateDialog"
			:title="t('authModule.tokens.createDialog.title', 'Create Personal Access Token')"
			class="max-w-[500px]"
			@close="onCreateDialogClose"
		>
			<el-form
				ref="createFormEl"
				:model="createForm"
				:rules="createRules"
				label-position="top"
			>
				<el-form-item
					:label="t('authModule.tokens.createDialog.name', 'Token Name')"
					prop="name"
				>
					<el-input
						v-model="createForm.name"
						:placeholder="t('authModule.tokens.createDialog.namePlaceholder', 'e.g. CI/CD Pipeline, Home Assistant')"
					/>
				</el-form-item>

				<el-form-item
					:label="t('authModule.tokens.createDialog.description', 'Description (optional)')"
					prop="description"
				>
					<el-input
						v-model="createForm.description"
						type="textarea"
						:rows="2"
						:placeholder="t('authModule.tokens.createDialog.descriptionPlaceholder', 'What is this token used for?')"
					/>
				</el-form-item>

				<el-form-item
					:label="t('authModule.tokens.createDialog.expiry', 'Expiration')"
					prop="expiresInDays"
				>
					<el-select
						v-model="createForm.expiresInDays"
						class="w-full"
					>
						<el-option
							:label="t('authModule.tokens.createDialog.expiry30', '30 days')"
							:value="30"
						/>
						<el-option
							:label="t('authModule.tokens.createDialog.expiry90', '90 days')"
							:value="90"
						/>
						<el-option
							:label="t('authModule.tokens.createDialog.expiry365', '1 year')"
							:value="365"
						/>
						<el-option
							:label="t('authModule.tokens.createDialog.expiryNever', 'No expiration')"
							:value="null"
						/>
					</el-select>
				</el-form-item>
			</el-form>

			<template #footer>
				<el-button @click="showCreateDialog = false">
					{{ t('authModule.tokens.createDialog.cancel', 'Cancel') }}
				</el-button>
				<el-button
					type="primary"
					:loading="isCreating"
					@click="onCreateToken"
				>
					{{ t('authModule.tokens.createDialog.submit', 'Create Token') }}
				</el-button>
			</template>
		</el-dialog>

		<!-- Token Created Dialog -->
		<el-dialog
			v-model="showTokenValueDialog"
			:title="t('authModule.tokens.createdDialog.title', 'Token Created Successfully')"
			class="max-w-[600px]"
			:close-on-click-modal="false"
			:close-on-press-escape="false"
		>
			<el-alert
				:title="t('authModule.tokens.createdDialog.warning', 'Copy this token now. You won\'t be able to see it again.')"
				type="warning"
				:closable="false"
				show-icon
				class="mb-4"
			/>

			<div class="flex items-center gap-2">
				<el-input
					:model-value="createdTokenValue"
					readonly
					class="flex-1 font-mono"
				/>
				<el-button
					type="primary"
					@click="onCopyToken"
				>
					<template #icon>
						<icon :icon="tokenCopied ? 'mdi:check' : 'mdi:content-copy'" />
					</template>
					{{ tokenCopied ? t('authModule.tokens.createdDialog.copied', 'Copied!') : t('authModule.tokens.createdDialog.copy', 'Copy') }}
				</el-button>
			</div>

			<template #footer>
				<el-button
					type="primary"
					@click="onTokenValueDialogClose"
				>
					{{ t('authModule.tokens.createdDialog.done', 'Done') }}
				</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElDialog,
	ElForm,
	ElFormItem,
	ElInput,
	ElMessageBox,
	ElOption,
	ElResult,
	ElSelect,
	ElTable,
	ElTableColumn,
	ElText,
	type FormInstance,
	type FormRules,
	vLoading,
} from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild, useFlashMessage } from '../../../../common';
import type { IPersonalToken } from '../../composables/usePersonalTokens';
import { usePersonalTokens } from '../../composables/usePersonalTokens';

interface ICreateTokenForm {
	name: string;
	description: string;
	expiresInDays: number | null;
}

defineOptions({
	name: 'PersonalTokensList',
});

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { tokens, loading, fetchTokens, createToken, revokeToken } = usePersonalTokens();

const showCreateDialog = ref(false);
const showTokenValueDialog = ref(false);
const isCreating = ref(false);
const revokingTokenId = ref<string | null>(null);
const createdTokenValue = ref('');
const tokenCopied = ref(false);

const createFormEl = ref<FormInstance | undefined>(undefined);

const createForm = reactive<ICreateTokenForm>({
	name: '',
	description: '',
	expiresInDays: 90,
});

const createRules = reactive<FormRules<ICreateTokenForm>>({
	name: [
		{
			required: true,
			message: t('authModule.tokens.createDialog.nameRequired', 'Token name is required'),
			trigger: 'change',
		},
	],
});

const formatDate = (date: string): string => {
	const d = new Date(date);
	return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
};

const isExpired = (date: string): boolean => {
	return new Date(date) < new Date();
};

const resetCreateForm = (): void => {
	createForm.name = '';
	createForm.description = '';
	createForm.expiresInDays = 90;
	createFormEl.value?.resetFields();
};

const onCreateDialogClose = (): void => {
	resetCreateForm();
};

const onCreateToken = async (): Promise<void> => {
	if (!createFormEl.value) {
		return;
	}

	createFormEl.value.validate(async (valid: boolean): Promise<void> => {
		if (!valid) {
			return;
		}

		isCreating.value = true;

		try {
			const result = await createToken({
				name: createForm.name,
				description: createForm.description || null,
				expires_in_days: createForm.expiresInDays,
			});

			if (result) {
				createdTokenValue.value = result.token;
				tokenCopied.value = false;
				showCreateDialog.value = false;
				showTokenValueDialog.value = true;
				resetCreateForm();

				flashMessage.success(
					t('authModule.tokens.messages.created', 'Personal access token created successfully.'),
				);
			} else {
				flashMessage.error(
					t('authModule.tokens.messages.createError', 'Failed to create personal access token.'),
				);
			}
		} catch {
			flashMessage.error(
				t('authModule.tokens.messages.createError', 'Failed to create personal access token.'),
			);
		} finally {
			isCreating.value = false;
		}
	});
};

const onCopyToken = async (): Promise<void> => {
	try {
		await navigator.clipboard.writeText(createdTokenValue.value);
		tokenCopied.value = true;
	} catch {
		flashMessage.error(
			t('authModule.tokens.messages.copyError', 'Failed to copy token to clipboard.'),
		);
	}
};

const onTokenValueDialogClose = (): void => {
	showTokenValueDialog.value = false;
	createdTokenValue.value = '';
	tokenCopied.value = false;
};

const onRevokeToken = (token: IPersonalToken): void => {
	ElMessageBox.confirm(
		t('authModule.tokens.revokeDialog.message', `Are you sure you want to revoke the token "${token.name}"? This action cannot be undone.`),
		t('authModule.tokens.revokeDialog.title', 'Revoke Token'),
		{
			confirmButtonText: t('authModule.tokens.revokeDialog.confirm', 'Revoke'),
			cancelButtonText: t('authModule.tokens.revokeDialog.cancel', 'Cancel'),
			type: 'warning',
			confirmButtonClass: 'el-button--danger',
		},
	)
		.then(async () => {
			revokingTokenId.value = token.id;

			try {
				const result = await revokeToken(token.id);

				if (result) {
					flashMessage.success(
						t('authModule.tokens.messages.revoked', 'Token revoked successfully.'),
					);
				} else {
					flashMessage.error(
						t('authModule.tokens.messages.revokeError', 'Failed to revoke token.'),
					);
				}
			} catch {
				flashMessage.error(
					t('authModule.tokens.messages.revokeError', 'Failed to revoke token.'),
				);
			} finally {
				revokingTokenId.value = null;
			}
		})
		.catch(() => {
			// Cancelled
		});
};

const openCreateDialog = (): void => {
	showCreateDialog.value = true;
};

defineExpose({ openCreateDialog });

onMounted(async () => {
	await fetchTokens();
});
</script>
