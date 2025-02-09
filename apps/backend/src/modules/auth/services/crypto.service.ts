import { randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';

@Injectable()
export class CryptoService {
	generateSecureSecret(): string {
		return randomBytes(32).toString('hex');
	}
}
