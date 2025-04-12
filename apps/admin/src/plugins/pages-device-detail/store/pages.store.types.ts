import { z } from 'zod';

import type { DeviceDetailPageSchema } from './pages.store.schemas';
import { DeviceDetailPageCreateReqSchema, DeviceDetailPageResSchema, DeviceDetailPageUpdateReqSchema } from './pages.store.schemas';

// STORE STATE
// ===========

export type IDeviceDetailPage = z.infer<typeof DeviceDetailPageSchema>;

// BACKEND API
// ===========

export type IDeviceDetailPageCreateReq = z.infer<typeof DeviceDetailPageCreateReqSchema>;

export type IDeviceDetailPageUpdateReq = z.infer<typeof DeviceDetailPageUpdateReqSchema>;

export type IDeviceDetailPageRes = z.infer<typeof DeviceDetailPageResSchema>;
