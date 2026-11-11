import { ref } from 'vue';

import { type Pinia, defineStore } from 'pinia';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend } from '../../../common';
import type {
	DevicesModbusPluginGetTemplatesOperation,
	DevicesModbusPluginPreviewTemplateOperation,
	DevicesModbusPluginReloadTemplatesOperation,
} from '../../../openapi.constants';
import { DEVICES_MODBUS_PLUGIN_PREFIX } from '../devices-modbus.constants';
import { DevicesModbusApiException } from '../devices-modbus.exceptions';

import { transformModbusTemplateCatalog, transformModbusTemplatePreview } from './modbus.transformers';
import type { IModbusTemplateCatalog, IModbusTemplatePreview, IModbusTemplatePreviewOverrides } from './templates.types';

const BASE = `/${PLUGINS_PREFIX}/${DEVICES_MODBUS_PLUGIN_PREFIX}/templates` as const;

export const useModbusTemplates = defineStore('devices_modbus_plugin-templates', () => {
	const backend = useBackend();
	const catalog = ref<IModbusTemplateCatalog | null>(null);
	// Fetch and reload both replace the catalog; only the most recently started request may, so an older fetch that
	// finishes late (for example one started by a component that has since unmounted) cannot undo a reload.
	let latestRequest = 0;

	const apply = (request: number, next: IModbusTemplateCatalog): IModbusTemplateCatalog => {
		if (request === latestRequest) {
			catalog.value = next;
		}

		return next;
	};

	const fetch = async (): Promise<IModbusTemplateCatalog> => {
		const request = ++latestRequest;
		const { data: responseData, error, response } = await backend.client.GET(BASE);

		if (responseData) {
			return apply(request, transformModbusTemplateCatalog(responseData.data));
		}

		throw new DevicesModbusApiException(
			getErrorReason<DevicesModbusPluginGetTemplatesOperation>(error, 'Failed to load the Modbus device templates.'),
			response.status
		);
	};

	const reload = async (): Promise<IModbusTemplateCatalog> => {
		const request = ++latestRequest;
		const { data: responseData, error, response } = await backend.client.POST(`${BASE}/reload`);

		if (responseData) {
			return apply(request, transformModbusTemplateCatalog(responseData.data));
		}

		throw new DevicesModbusApiException(
			getErrorReason<DevicesModbusPluginReloadTemplatesOperation>(error, 'Failed to reload the Modbus device templates.'),
			response.status
		);
	};

	const preview = async (id: string, overrides: IModbusTemplatePreviewOverrides = {}): Promise<IModbusTemplatePreview> => {
		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`${BASE}/{id}/preview`, {
			params: { path: { id } },
			body: {
				data: {
					...(overrides.unitId !== undefined ? { unit_id: overrides.unitId } : {}),
					...(overrides.pollIntervalMs !== undefined ? { poll_interval_ms: overrides.pollIntervalMs } : {}),
				},
			},
		});

		if (responseData) {
			return transformModbusTemplatePreview(responseData.data);
		}

		throw new DevicesModbusApiException(
			getErrorReason<DevicesModbusPluginPreviewTemplateOperation>(error, 'Failed to preview the Modbus device template.'),
			response.status
		);
	};

	return { catalog, fetch, reload, preview };
});

export const registerModbusTemplatesStore = (pinia: Pinia): ReturnType<typeof useModbusTemplates> => useModbusTemplates(pinia);
