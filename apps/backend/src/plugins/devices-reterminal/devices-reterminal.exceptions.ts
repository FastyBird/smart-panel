import { HttpException, HttpStatus } from '@nestjs/common';

export class DevicesReTerminalException extends HttpException {
	constructor(message: string, status: HttpStatus) {
		super(message, status);
	}
}

export class ReTerminalHardwareNotFoundException extends DevicesReTerminalException {
	constructor() {
		super('reTerminal hardware not detected on this system', HttpStatus.NOT_FOUND);
	}
}

export class ReTerminalSysfsAccessException extends DevicesReTerminalException {
	constructor(path: string) {
		super(`Failed to access sysfs path: ${path}`, HttpStatus.SERVICE_UNAVAILABLE);
	}
}
