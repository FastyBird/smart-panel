import { randomInt } from 'crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { GO2RTC_INSTALLATION_ID_FILENAME } from '../cameras.constants';

const INSTALLATION_ID_PATTERN = /^[a-z0-9]{8}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateInstallationId(): string {
	let id = '';

	for (let i = 0; i < 8; i++) {
		id += ALPHABET[randomInt(ALPHABET.length)];
	}

	return id;
}

/**
 * The random id of this installation, kept in `<configDir>/installation-id` (0600, in the 0700 go2rtc directory).
 * Created on first use, reused afterwards; content that is not an 8 character `[a-z0-9]` id is replaced.
 */
export function loadOrCreateInstallationId(configDir: string): string {
	mkdirSync(configDir, { recursive: true, mode: 0o700 });
	// `mkdir` leaves the mode of a directory that already exists alone.
	chmodSync(configDir, 0o700);

	const path = join(configDir, GO2RTC_INSTALLATION_ID_FILENAME);

	try {
		const existing = readFileSync(path, 'utf8').trim();

		if (INSTALLATION_ID_PATTERN.test(existing)) {
			return existing;
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			throw error;
		}
	}

	const id = generateInstallationId();

	writeFileSync(path, `${id}\n`, { mode: 0o600 });
	chmodSync(path, 0o600);

	return id;
}
