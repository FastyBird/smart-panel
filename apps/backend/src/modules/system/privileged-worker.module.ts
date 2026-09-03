import { Global, Module } from '@nestjs/common';

import { PlatformModule } from '../platform/platform.module';

import { PrivilegedWorkerService } from './services/privileged-worker.service';

/**
 * `PrivilegedWorkerService` is designed to be reused, unchanged, by any
 * future privileged-operation consumer (RA-3's own extraction from the
 * update executor names Tailscale setup as the first such reuse). Extracted
 * into its own `@Global()` module — the same shape as `FactoryResetModule`
 * — so a plugin can inject it directly instead of importing all of the much
 * heavier `SystemModule` (Auth, Storage, Stats, Spaces, Users, Devices,
 * Displays, Extensions...) just for this one service. `SystemModule` no
 * longer provides `PrivilegedWorkerService` itself; `UpdateExecutorService`
 * gets it from here exactly like every other consumer.
 */
@Global()
@Module({
	imports: [PlatformModule],
	providers: [PrivilegedWorkerService],
	exports: [PrivilegedWorkerService],
})
export class PrivilegedWorkerModule {}
