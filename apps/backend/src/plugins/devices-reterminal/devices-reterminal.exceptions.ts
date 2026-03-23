import { HttpException, HttpStatus } from '@nestjs/common';

export class DevicesReTerminalException extends HttpException {
	constructor(message: string, status: HttpStatus) {
		super(message, status);
	}
}
