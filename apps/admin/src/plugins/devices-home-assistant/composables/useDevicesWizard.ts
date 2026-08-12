import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useFlashMessage, useLogger } from '../../../common';
import { RouteNames as ConfigRouteNames } from '../../../modules/config';
import {
	RouteNames as DevicesRouteNames,
	FormResult,
	type FormResultType,
	type IDeviceWizardAdapter,
	type IWizardAdoptSelection,
	type IWizardControl,
	type IWizardResult,
	type IWizardRow,
} from '../../../modules/devices';
import type {
	DevicesHomeAssistantPluginAdoptWizardOperation,
	DevicesHomeAssistantPluginCreateWizardOperation,
	DevicesHomeAssistantPluginDeleteWizardOperation,
	DevicesHomeAssistantPluginWizardAdoptionSchema,
	DevicesHomeAssistantPluginWizardSessionSchema,
} from '../../../openapi.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantApiException } from '../devices-home-assistant.exceptions';
import type { IHomeAssistantWizardAdoptionResult, IHomeAssistantWizardCandidate, IHomeAssistantWizardSession } from '../schemas/wizard.types';
import { transformWizardAdoptRequest, transformWizardAdoptionResponse, transformWizardSessionResponse } from '../utils/wizard.transformers';

export const useDevicesWizard = (): IDeviceWizardAdapter => {
	const { t } = useI18n();
	const backend = useBackend();
	const flashMessage = useFlashMessage();
	const logger = useLogger();
	const session = ref<IHomeAssistantWizardSession | null>(null);
	const adoptionResults = ref<IHomeAssistantWizardAdoptionResult[]>([]);
	const formResult = ref<FormResultType>(FormResult.NONE);
	const sessionError = ref<string | null>(null);

	const candidates = computed<IHomeAssistantWizardCandidate[]>(() =>
		orderBy(session.value?.candidates ?? [], [(candidate) => (candidate.status === 'ready' ? 0 : 1), (candidate) => candidate.name], ['asc', 'asc'])
	);

	const rows = computed<IWizardRow[]>(() =>
		candidates.value.map((candidate) => ({
			key: candidate.key,
			label: candidate.name,
			subLabel: [candidate.manufacturer, candidate.model].filter(Boolean).join(' · ') || null,
			identifier: candidate.sourceId,
			status: candidate.status,
			statusLabel: candidate.status === 'needs_attention' ? t('devicesHomeAssistantPlugin.wizard.statuses.needsAttention') : undefined,
			adoptable: candidate.status === 'ready',
			selectedByDefault: false,
			willUpdate: false,
			suggestedName: candidate.name,
			suggestedCategory: candidate.suggestedCategory,
			categoryOptions:
				candidate.suggestedCategory === null
					? []
					: [
							{
								value: candidate.suggestedCategory,
								label: t(`devicesModule.categories.devices.${candidate.suggestedCategory}`),
							},
						],
			cells: {
				kind: {
					render: 'tag',
					value: t(`devicesHomeAssistantPlugin.wizard.kinds.${candidate.kind}`),
					variant: 'info',
				},
				channels: {
					render: 'tag',
					value: t('devicesHomeAssistantPlugin.wizard.columns.channelsCount', {
						count: candidate.previewChannelCount,
					}),
					variant: candidate.warningCount > 0 ? 'warning' : 'success',
					tooltip:
						candidate.warningCount > 0 ? t('devicesHomeAssistantPlugin.wizard.columns.warningsCount', { count: candidate.warningCount }) : undefined,
				},
			},
		}))
	);

	const results = computed<IWizardResult[]>(() =>
		adoptionResults.value.map((result) => ({
			key: result.key,
			name: result.name,
			identifier: session.value?.candidates.find((candidate) => candidate.key === result.key)?.sourceId ?? result.key,
			status: result.status,
			error: result.error,
		}))
	);

	const controls = computed<IWizardControl[]>(() => {
		const refreshControl: IWizardControl = {
			type: 'action',
			id: 'refresh',
			label: t('devicesHomeAssistantPlugin.wizard.actions.refresh'),
			icon: 'mdi:refresh',
			variant: 'default',
			disabled: formResult.value === FormResult.WORKING,
			loading: formResult.value === FormResult.WORKING,
			handler: async (): Promise<void> => {
				await endSession();
				await startSession();
			},
		};

		if (sessionError.value !== null) {
			return [
				{
					type: 'banner',
					id: 'connection-error',
					severity: 'warning',
					title: t('devicesHomeAssistantPlugin.wizard.connectionError.title'),
					message: sessionError.value,
					link: {
						label: t('devicesHomeAssistantPlugin.wizard.connectionError.openConfig'),
						to: {
							name: ConfigRouteNames.CONFIG_PLUGIN_EDIT,
							params: { plugin: DEVICES_HOME_ASSISTANT_PLUGIN_NAME },
						},
					},
				},
				refreshControl,
			];
		}

		const reviewCount = candidates.value.filter((candidate) => candidate.status === 'needs_attention').length;

		if (reviewCount === 0) {
			return [refreshControl];
		}

		return [
			{
				type: 'banner',
				id: 'manual-review',
				severity: 'info',
				title: t('devicesHomeAssistantPlugin.wizard.manualReview.title', { count: reviewCount }),
				message: t('devicesHomeAssistantPlugin.wizard.manualReview.message'),
				link: {
					label: t('devicesHomeAssistantPlugin.wizard.manualReview.open'),
					to: { name: DevicesRouteNames.DEVICES_ADD },
				},
			},
			refreshControl,
		];
	});

	const startSession = async (): Promise<void> => {
		formResult.value = FormResult.WORKING;
		sessionError.value = null;
		const { data, error, response } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/wizard`);

		if (typeof data !== 'undefined') {
			session.value = transformWizardSessionResponse((data as { data: DevicesHomeAssistantPluginWizardSessionSchema }).data);
			adoptionResults.value = [];
			formResult.value = FormResult.OK;
			return;
		}

		const fallback = t('devicesHomeAssistantPlugin.wizard.messages.sessionNotStarted');
		const reason = error ? getErrorReason<DevicesHomeAssistantPluginCreateWizardOperation>(error, fallback) : fallback;
		formResult.value = FormResult.ERROR;
		sessionError.value = reason;
		flashMessage.error(reason);
		throw new DevicesHomeAssistantApiException(reason, response.status);
	};

	const endSession = async (): Promise<void> => {
		const currentSession = session.value;
		session.value = null;
		sessionError.value = null;

		if (!currentSession) {
			return;
		}

		try {
			const { error } = await backend.client.DELETE(`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/wizard/{id}`, {
				params: { path: { id: currentSession.id } },
			});

			if (error) {
				logger.warn(getErrorReason<DevicesHomeAssistantPluginDeleteWizardOperation>(error, 'Failed to cleanly end Home Assistant wizard session'));
			}
		} catch (error: unknown) {
			logger.warn('Failed to cleanly end Home Assistant wizard session', error);
		}
	};

	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		if (!session.value) {
			return [];
		}

		formResult.value = FormResult.WORKING;
		const { data, error, response } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_HOME_ASSISTANT_PLUGIN_PREFIX}/wizard/{id}/adopt`, {
			params: { path: { id: session.value.id } },
			body: transformWizardAdoptRequest(selection.map((item) => item.key)),
		});

		if (typeof data !== 'undefined') {
			adoptionResults.value = transformWizardAdoptionResponse((data as { data: DevicesHomeAssistantPluginWizardAdoptionSchema }).data);
			formResult.value = adoptionResults.value.some((result) => result.status === 'failed') ? FormResult.ERROR : FormResult.OK;
			return results.value;
		}

		const fallback = t('devicesHomeAssistantPlugin.wizard.messages.adoptionFailed');
		const reason = error ? getErrorReason<DevicesHomeAssistantPluginAdoptWizardOperation>(error, fallback) : fallback;
		formResult.value = FormResult.ERROR;
		flashMessage.error(reason);
		throw new DevicesHomeAssistantApiException(reason, response.status);
	};

	return {
		title: t('devicesHomeAssistantPlugin.wizard.title'),
		subtitle: t('devicesHomeAssistantPlugin.wizard.subtitle'),
		breadcrumbLabel: t('devicesHomeAssistantPlugin.wizard.breadcrumb'),
		pluginType: DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		identifierLabel: t('devicesHomeAssistantPlugin.wizard.columns.identifier'),
		confirmationMode: 'selection-only',
		rows,
		results,
		columns: [
			{ key: 'kind', label: t('devicesHomeAssistantPlugin.wizard.columns.kind'), steps: ['discover'], width: 120 },
			{
				key: 'channels',
				label: t('devicesHomeAssistantPlugin.wizard.columns.channels'),
				steps: ['discover', 'confirm'],
				width: 130,
			},
		],
		controls,
		sessionKey: computed(() => session.value?.id ?? null),
		ready: computed(() => session.value !== null || sessionError.value !== null),
		busy: computed(() => formResult.value === FormResult.WORKING),
		capabilities: { addMore: true },
		start: startSession,
		adopt,
		restart: async (): Promise<void> => {
			await endSession();
			await startSession();
		},
		dispose: endSession,
	};
};
