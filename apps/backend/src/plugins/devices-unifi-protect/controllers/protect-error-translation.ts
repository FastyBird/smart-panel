import { NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';

import {
	ProtectConsoleUnavailableError,
	ProtectDeviceNotFoundError,
	ProtectUnsupportedDeviceError,
} from '../errors/protect-adoption.error';

/** Maps the adoption errors to their HTTP exceptions; anything else is returned unchanged. */
export const translate = (error: unknown): unknown => {
	if (error instanceof ProtectConsoleUnavailableError) {
		return new ServiceUnavailableException('The UniFi Protect console is not connected');
	}

	if (error instanceof ProtectDeviceNotFoundError) {
		return new NotFoundException('UniFi Protect device not found');
	}

	if (error instanceof ProtectUnsupportedDeviceError) {
		return new UnprocessableEntityException('The UniFi Protect device has no supported mapping');
	}

	return error;
};
