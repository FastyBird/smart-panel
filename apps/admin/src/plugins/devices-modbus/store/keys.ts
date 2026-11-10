import type { InjectionKey } from 'vue';

import type { useModbusEndpoints } from './endpoints.store';
import type { useModbusTemplates } from './templates.store';

export const modbusEndpointsStoreKey: InjectionKey<ReturnType<typeof useModbusEndpoints>> = Symbol('devices_modbus_plugin-endpoints');
export const modbusTemplatesStoreKey: InjectionKey<ReturnType<typeof useModbusTemplates>> = Symbol('devices_modbus_plugin-templates');
