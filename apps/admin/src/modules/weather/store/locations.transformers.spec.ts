import { describe, expect, it } from 'vitest';

import { WeatherValidationException } from '../weather.exceptions';

import type { IWeatherLocationRes } from './locations.store.types';
import { transformLocationResponse, transformLocationCreateRequest, transformLocationUpdateRequest } from './locations.transformers';

const mockLocationRes = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	type: 'weather-openweathermap',
	name: 'Home',
	order: 0,
	created_at: '2025-01-15T10:30:00Z',
	updated_at: '2025-01-16T14:20:00Z',
};

const mockTransformedLocation = {
	id: '123e4567-e89b-12d3-a456-426614174000',
	type: 'weather-openweathermap',
	name: 'Home',
	order: 0,
	draft: false,
	createdAt: new Date('2025-01-15T10:30:00Z'),
	updatedAt: new Date('2025-01-16T14:20:00Z'),
};

describe('Weather Locations Transformers', () => {
	describe('transformLocationResponse', () => {
		it('should transform location response successfully', () => {
			const result = transformLocationResponse(mockLocationRes);

			expect(result).toEqual(mockTransformedLocation);
		});

		it('should transform location response with null updatedAt', () => {
			const result = transformLocationResponse({
				...mockLocationRes,
				updated_at: null,
			});

			expect(result.updatedAt).toBeNull();
		});

		it('should throw validation error for invalid location response', () => {
			const invalidResponse = {
				id: 'invalid-uuid',
				type: '',
				name: '',
			};

			expect(() => transformLocationResponse(invalidResponse as unknown as IWeatherLocationRes)).toThrow(WeatherValidationException);
		});

		it('should throw validation error for missing required fields', () => {
			const invalidResponse = {
				id: '123e4567-e89b-12d3-a456-426614174000',
			};

			expect(() => transformLocationResponse(invalidResponse as unknown as IWeatherLocationRes)).toThrow(WeatherValidationException);
		});

		it('should preserve additional passthrough fields', () => {
			const responseWithExtra = {
				...mockLocationRes,
				apiKey: 'secret-key',
				latitude: 51.5074,
			};

			const result = transformLocationResponse(responseWithExtra);

			expect(result).toHaveProperty('apiKey', 'secret-key');
			expect(result).toHaveProperty('latitude', 51.5074);
		});
	});

	describe('transformLocationCreateRequest', () => {
		it('should transform create request successfully', () => {
			const createData = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				type: 'weather-openweathermap',
				name: 'Office',
			};

			const result = transformLocationCreateRequest(createData);

			expect(result).toEqual(createData);
		});

		it('should transform create request without id', () => {
			const createData = {
				type: 'weather-openweathermap',
				name: 'Office',
			};

			const result = transformLocationCreateRequest(createData);

			expect(result.type).toBe('weather-openweathermap');
			expect(result.name).toBe('Office');
		});

		it('should throw validation error for empty type', () => {
			const invalidData = {
				type: '',
				name: 'Office',
			};

			expect(() => transformLocationCreateRequest(invalidData)).toThrow(WeatherValidationException);
		});

		it('should throw validation error for empty name', () => {
			const invalidData = {
				type: 'weather-openweathermap',
				name: '',
			};

			expect(() => transformLocationCreateRequest(invalidData)).toThrow(WeatherValidationException);
		});

		it('should preserve additional passthrough fields', () => {
			const createData = {
				type: 'weather-openweathermap',
				name: 'Office',
				apiKey: 'test-api-key',
				latitude: 40.7128,
				longitude: -74.0060,
			};

			const result = transformLocationCreateRequest(createData);

			expect(result).toHaveProperty('apiKey', 'test-api-key');
			expect(result).toHaveProperty('latitude', 40.7128);
		});
	});

	describe('transformLocationUpdateRequest', () => {
		it('should transform update request successfully', () => {
			const updateData = {
				type: 'weather-openweathermap',
				name: 'Updated Name',
			};

			const result = transformLocationUpdateRequest(updateData);

			expect(result).toEqual(updateData);
		});

		it('should transform update request with only type', () => {
			const updateData = {
				type: 'weather-openweathermap',
			};

			const result = transformLocationUpdateRequest(updateData);

			expect(result.type).toBe('weather-openweathermap');
		});

		it('should throw validation error for empty type', () => {
			const invalidData = {
				type: '',
				name: 'Updated Name',
			};

			expect(() => transformLocationUpdateRequest(invalidData)).toThrow(WeatherValidationException);
		});

		it('should preserve additional passthrough fields', () => {
			const updateData = {
				type: 'weather-openweathermap',
				name: 'Updated Name',
				apiKey: 'new-api-key',
			};

			const result = transformLocationUpdateRequest(updateData);

			expect(result).toHaveProperty('apiKey', 'new-api-key');
		});
	});
});
