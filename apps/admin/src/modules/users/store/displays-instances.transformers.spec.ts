import { v4 as uuid } from 'uuid';
import { describe, expect, it } from 'vitest';

import { UsersValidationException } from '../users.exceptions';

import type { IDisplaysInstancesAddActionPayload, IDisplaysInstancesEditActionPayload } from './displays-instances.store.types';
import {
	transformDisplayInstanceCreateRequest,
	transformDisplayInstanceResponse,
	transformDisplayInstanceUpdateRequest,
} from './displays-instances.transformers';

const displayId = uuid();

// Note: Display response now comes from DisplaysModule with new schema
const validDisplayResponse = {
	id: displayId,
	mac_address: '00:1A:2B:3C:4D:5E',
	name: 'Test Display',
	version: '1.0.0',
	build: '42',
	screen_width: 1920,
	screen_height: 1080,
	pixel_ratio: 1.5,
	unit_size: 8,
	rows: 12,
	cols: 24,
	dark_mode: false,
	brightness: 100,
	screen_lock_duration: 30,
	screen_saver: true,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
};

const validDisplayCreatePayload: IDisplaysInstancesAddActionPayload['data'] = {
	uid: displayId, // Using UID for backward compatibility
	mac: '00:1A:2B:3C:4D:5E',
	version: '1.0.0',
	build: '42',
	user: uuid(),
};

const validDisplayUpdatePayload: IDisplaysInstancesEditActionPayload['data'] = {
	version: '1.0.0',
	build: '42',
};

describe('Displays Instances Transformers', (): void => {
	describe('transformDisplayInstanceResponse', (): void => {
		it('should transform a valid display instance response', (): void => {
			const result = transformDisplayInstanceResponse(validDisplayResponse);

			expect(result.id).toBe(displayId);
			expect(result.uid).toBe(displayId); // UID now equals ID
			expect(result.mac).toBe('00:1A:2B:3C:4D:5E');
			expect(result.version).toBe('1.0.0');
			expect(result.build).toBe('42');
			expect(result.user).toBe(''); // User no longer tied to display
			expect(result.displayProfile).toBeNull();
			expect(result.draft).toBe(false);
		});

		it('should throw an error for an invalid display instance response', (): void => {
			expect(() => transformDisplayInstanceResponse({ ...validDisplayResponse, id: null })).toThrow(UsersValidationException);
		});
	});

	describe('transformDisplayCreateRequest', (): void => {
		it('should transform a valid display instance create request', (): void => {
			const result = transformDisplayInstanceCreateRequest(validDisplayCreatePayload);

			expect(result.mac_address).toBe('00:1A:2B:3C:4D:5E');
			expect(result.version).toBe('1.0.0');
			expect(result.build).toBe('42');
		});
	});

	describe('transformDisplayUpdateRequest', (): void => {
		it('should transform a valid display instance update request', (): void => {
			const result = transformDisplayInstanceUpdateRequest(validDisplayUpdatePayload);

			expect(result).toEqual({
				version: '1.0.0',
				build: '42',
			});
		});
	});
});
