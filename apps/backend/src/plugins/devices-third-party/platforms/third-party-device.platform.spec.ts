/*
eslint-disable @typescript-eslint/no-unsafe-call,
@typescript-eslint/no-unsafe-assignment
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';

import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';
import { PropertiesUpdateRequestDto } from '../dto/third-party-property-update-request.dto';
import { PropertiesUpdateResponseDto } from '../dto/third-party-property-update-response.dto';
import { ThirdPartyDeviceEntity } from '../entities/devices-third-party.entity';

import { ThirdPartyDevicePlatform } from './third-party-device.platform';

jest.mock('node-fetch');

const { Response } = jest.requireActual('node-fetch');

describe('ThirdPartyDevicePlatform', () => {
	let platform: ThirdPartyDevicePlatform;
	let mockDevice: ThirdPartyDeviceEntity;
	let mockChannel: ChannelEntity;
	let mockChannelProperty: ChannelPropertyEntity;
	let loggerErrorSpy: jest.SpyInstance;
	let loggerWarnSpy: jest.SpyInstance;
	let loggerLogSpy: jest.SpyInstance;
	let mockSendCommand: jest.SpyInstance;

	beforeEach(() => {
		platform = new ThirdPartyDevicePlatform();

		mockDevice = { id: uuid().toString(), serviceAddress: 'http://device.local' } as ThirdPartyDeviceEntity;
		mockChannel = { id: uuid().toString() } as ChannelEntity;
		mockChannelProperty = { id: uuid().toString() } as ChannelPropertyEntity;

		// Spy on logger methods
		loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
		loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

		// Mock sendCommand method
		mockSendCommand = jest.spyOn(platform as any, 'sendCommand');

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should return true on successful 204 response', async () => {
		mockSendCommand.mockResolvedValue(new Response(null, { status: 204 }));

		const result = await platform.processBatch([
			{
				device: mockDevice,
				channel: mockChannel,
				property: mockChannelProperty,
				value: 50,
			},
		]);

		expect(result).toBe(true);
		expect(loggerLogSpy).toHaveBeenCalledWith('[THIRD-PARTY][PLATFORM] Successfully updated properties');
	});

	it('should return true when all updates succeed (207 response)', async () => {
		const mockResponseBody = {
			properties: [
				{
					device: mockDevice.id,
					channel: mockChannel.id,
					property: mockChannelProperty.id,
					status: ThirdPartyPropertiesUpdateStatus.SUCCESS,
				},
			],
		};

		mockSendCommand.mockResolvedValue(new Response(JSON.stringify(mockResponseBody), { status: 207 }));

		const result = await platform.processBatch([
			{
				device: mockDevice,
				channel: mockChannel,
				property: mockChannelProperty,
				value: 50,
			},
		]);

		expect(result).toBe(true);
		expect(loggerLogSpy).toHaveBeenCalledWith(
			`[THIRD-PARTY][PLATFORM] Successfully processed all property updates for device id=${mockDevice.id}`,
		);
	});

	it('should return false when some properties fail (207 response)', async () => {
		const mockResponseBody = {
			properties: [
				{
					device: mockDevice.id,
					channel: mockChannel.id,
					property: mockChannelProperty.id,
					status: ThirdPartyPropertiesUpdateStatus.INVALID_VALUE,
				},
			],
		};

		mockSendCommand.mockResolvedValue(new Response(JSON.stringify(mockResponseBody), { status: 207 }));

		const result = await platform.processBatch([
			{
				device: mockDevice,
				channel: mockChannel,
				property: mockChannelProperty,
				value: 50,
			},
		]);

		expect(result).toBe(false);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				`[THIRD-PARTY][PLATFORM] Some properties failed to update for device id=${mockDevice.id}: ${JSON.stringify(mockResponseBody.properties)}`,
			),
		);
	});

	it('should return false on unexpected response status', async () => {
		mockSendCommand.mockResolvedValue(new Response(null, { status: 500 }));

		const result = await platform.processBatch([
			{
				device: mockDevice,
				channel: mockChannel,
				property: mockChannelProperty,
				value: 50,
			},
		]);

		expect(result).toBe(false);
		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('[THIRD-PARTY][PLATFORM] Unexpected response status=500'),
		);
	});

	it('should return false on network error', async () => {
		mockSendCommand.mockRejectedValue(new Error('Network error'));

		const result = await platform.processBatch([
			{
				device: mockDevice,
				channel: mockChannel,
				property: mockChannelProperty,
				value: 50,
			},
		]);

		expect(result).toBe(false);
		expect(loggerErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining('[THIRD-PARTY][PLATFORM] Error processing property update'),
			expect.any(Object),
		);
	});

	it('should return false if request payload validation fails', async () => {
		const validateSpy = jest.spyOn(platform as any, 'validateDto').mockResolvedValue(false);

		const result = await platform.processBatch([
			{
				device: mockDevice,
				channel: mockChannel,
				property: mockChannelProperty,
				value: 50,
			},
		]);

		expect(result).toBe(false);
		expect(validateSpy).toHaveBeenCalledWith(PropertiesUpdateRequestDto, expect.any(Object), 'request');
	});

	it('should return false if response payload validation fails', async () => {
		const validateSpy = jest.spyOn(platform as any, 'validateDto').mockImplementation((_, __, context) => {
			return context === 'request';
		});

		mockSendCommand.mockResolvedValue(new Response(JSON.stringify({}), { status: 207 }));

		const result = await platform.processBatch([
			{
				device: mockDevice,
				channel: mockChannel,
				property: mockChannelProperty,
				value: 50,
			},
		]);

		expect(result).toBe(false);
		expect(validateSpy).toHaveBeenCalledWith(PropertiesUpdateResponseDto, expect.any(Object), 'response');
	});
});
