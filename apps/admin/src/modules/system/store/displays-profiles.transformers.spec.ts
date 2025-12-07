import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { SystemValidationException } from '../system.exceptions';

import type { IDisplayProfileRes, IDisplaysProfilesAddActionPayload, IDisplaysProfilesEditActionPayload } from './displays-profiles.store.types';
import {
	transformDisplayProfileCreateRequest,
	transformDisplayProfileResponse,
	transformDisplayProfileUpdateRequest,
} from './displays-profiles.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
		},
	};
});

const displayId = uuid();

// Note: Display response now comes from DisplaysModule with new schema
const validDisplayResponse = {
	id: displayId,
	mac_address: 'AA:BB:CC:DD:EE:FF',
	name: 'Test Display',
	version: '1.0.0',
	build: '42',
	screen_width: 1280,
	screen_height: 720,
	pixel_ratio: 2,
	unit_size: 120,
	rows: 6,
	cols: 4,
	dark_mode: false,
	brightness: 100,
	screen_lock_duration: 30,
	screen_saver: true,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validDisplayCreatePayload: IDisplaysProfilesAddActionPayload['data'] = {
	uid: displayId, // Using UID for backward compatibility
	screenWidth: 1280,
	screenHeight: 720,
	pixelRatio: 2,
	unitSize: 120,
	rows: 6,
	cols: 4,
};

const validDisplayUpdatePayload: IDisplaysProfilesEditActionPayload['data'] = {
	rows: 6,
	cols: 6,
};

describe('Displays Profiles Transformers', (): void => {
	describe('transformDisplayResponse', (): void => {
		it('should transform a valid display profile response', (): void => {
			const result = transformDisplayProfileResponse(validDisplayResponse);

			expect(result.id).toBe(displayId);
			expect(result.uid).toBe(displayId); // UID now equals ID
			expect(result.screenWidth).toBe(1280);
			expect(result.screenHeight).toBe(720);
			expect(result.pixelRatio).toBe(2);
			expect(result.unitSize).toBe(120);
			expect(result.rows).toBe(6);
			expect(result.cols).toBe(4);
			expect(result.primary).toBe(false); // Primary is now always false
		});

		it('should throw an error for an invalid display profile response', (): void => {
			expect(() => transformDisplayProfileResponse({ ...validDisplayResponse, id: null })).toThrow(SystemValidationException);
		});
	});

	describe('transformDisplayCreateRequest', (): void => {
		it('should transform a valid display profile create request', (): void => {
			const result = transformDisplayProfileCreateRequest(validDisplayCreatePayload);

			expect(result.mac_address).toBe(displayId); // UID becomes mac_address
			expect(result.version).toBe('1.0.0');
			expect(result.screen_width).toBe(1280);
			expect(result.screen_height).toBe(720);
			expect(result.pixel_ratio).toBe(2);
			expect(result.unit_size).toBe(120);
			expect(result.rows).toBe(6);
			expect(result.cols).toBe(4);
		});
	});

	describe('transformDisplayUpdateRequest', (): void => {
		it('should transform a valid display profile update request', (): void => {
			const result = transformDisplayProfileUpdateRequest(validDisplayUpdatePayload);

			expect(result).toEqual({
				rows: 6,
				cols: 6,
			});
		});
	});
});
