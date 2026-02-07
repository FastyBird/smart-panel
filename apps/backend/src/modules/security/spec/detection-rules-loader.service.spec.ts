import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { SecurityAlertType, Severity } from '../security.constants';

import { DetectionRulesLoaderService } from './detection-rules-loader.service';

jest.mock('fs', () => {
	const actual: Record<string, unknown> = jest.requireActual('fs');

	return {
		...actual,
		existsSync: jest.fn(actual.existsSync as (...args: unknown[]) => unknown),
		readFileSync: jest.fn(actual.readFileSync as (...args: unknown[]) => unknown),
	};
});

const existsSyncMock = existsSync as jest.MockedFunction<typeof existsSync>;
const readFileSyncMock = readFileSync as jest.MockedFunction<typeof readFileSync>;

describe('DetectionRulesLoaderService', () => {
	let service: DetectionRulesLoaderService;

	const realExistsSync = jest.requireActual<typeof import('fs')>('fs').existsSync;
	const realReadFileSync = jest.requireActual<typeof import('fs')>('fs').readFileSync;

	beforeEach(async () => {
		existsSyncMock.mockImplementation(realExistsSync);
		readFileSyncMock.mockImplementation(realReadFileSync);

		const module: TestingModule = await Test.createTestingModule({
			providers: [DetectionRulesLoaderService],
		}).compile();

		service = module.get<DetectionRulesLoaderService>(DetectionRulesLoaderService);
	});

	describe('builtin rules loading', () => {
		it('should load builtin detection rules on init', () => {
			service.onModuleInit();

			const rules = service.getSensorRules();

			expect(rules.size).toBeGreaterThan(0);
		});

		it('should load smoke rule correctly', () => {
			service.onModuleInit();

			const rules = service.getSensorRules();
			const smoke = rules.get(ChannelCategory.SMOKE);

			expect(smoke).toBeDefined();
			expect(smoke?.alertType).toBe(SecurityAlertType.SMOKE);
			expect(smoke?.severity).toBe(Severity.CRITICAL);
			expect(smoke?.channelCategory).toBe(ChannelCategory.SMOKE);
			expect(smoke?.properties).toHaveLength(1);
			expect(smoke?.properties[0].property).toBe(PropertyCategory.DETECTED);
			expect(smoke?.properties[0].operator).toBe('eq');
			expect(smoke?.properties[0].value).toBe(true);
		});

		it('should load carbon_monoxide rule with multiple properties', () => {
			service.onModuleInit();

			const rules = service.getSensorRules();
			const co = rules.get(ChannelCategory.CARBON_MONOXIDE);

			expect(co).toBeDefined();
			expect(co?.alertType).toBe(SecurityAlertType.CO);
			expect(co?.severity).toBe(Severity.CRITICAL);
			expect(co?.properties).toHaveLength(2);
			expect(co?.properties[0].property).toBe(PropertyCategory.DETECTED);
			expect(co?.properties[1].property).toBe(PropertyCategory.CONCENTRATION);
			expect(co?.properties[1].operator).toBe('gt');
			expect(co?.properties[1].value).toBe(35);
		});

		it('should load gas rule with in operator', () => {
			service.onModuleInit();

			const rules = service.getSensorRules();
			const gas = rules.get(ChannelCategory.GAS);

			expect(gas).toBeDefined();
			expect(gas?.properties).toHaveLength(2);
			expect(gas?.properties[1].operator).toBe('in');
			expect(gas?.properties[1].value).toEqual(['warning', 'alarm']);
		});

		it('should load all expected channel categories', () => {
			service.onModuleInit();

			const rules = service.getSensorRules();

			expect(rules.has(ChannelCategory.SMOKE)).toBe(true);
			expect(rules.has(ChannelCategory.CARBON_MONOXIDE)).toBe(true);
			expect(rules.has(ChannelCategory.LEAK)).toBe(true);
			expect(rules.has(ChannelCategory.GAS)).toBe(true);
			expect(rules.has(ChannelCategory.MOTION)).toBe(true);
			expect(rules.has(ChannelCategory.OCCUPANCY)).toBe(true);
			expect(rules.has(ChannelCategory.CONTACT)).toBe(true);
			expect(rules.size).toBe(7);
		});
	});

	describe('user overrides', () => {
		it('should merge user rules by overriding builtin for same key', () => {
			const userYaml = `
sensors:
  smoke:
    alert_type: smoke
    severity: warning
    properties:
      - property: concentration
        operator: gt
        value: 100
`;

			const builtinDefPath = join(__dirname, 'definitions', 'detection-rules.yaml');
			const builtinContent = realReadFileSync(builtinDefPath, 'utf-8');

			existsSyncMock.mockImplementation((p: string) => {
				if (p === builtinDefPath) return true;
				if (p.includes('var/security')) return true;

				return false;
			});

			readFileSyncMock.mockImplementation((p: string | number | URL, options?: object | BufferEncoding | null) => {
				const filePath = String(p);

				if (filePath === builtinDefPath) return builtinContent;
				if (filePath.includes('var/security')) return userYaml;

				return realReadFileSync(p as string, options as BufferEncoding);
			});

			service.loadAllRules();

			const rules = service.getSensorRules();
			const smoke = rules.get(ChannelCategory.SMOKE);

			// User overrode smoke: severity changed to warning, property changed to concentration > 100
			expect(smoke).toBeDefined();
			expect(smoke?.severity).toBe(Severity.WARNING);
			expect(smoke?.properties).toHaveLength(1);
			expect(smoke?.properties[0].property).toBe(PropertyCategory.CONCENTRATION);
			expect(smoke?.properties[0].operator).toBe('gt');
			expect(smoke?.properties[0].value).toBe(100);

			// Other rules should still be present from builtin
			expect(rules.has(ChannelCategory.MOTION)).toBe(true);
		});
	});

	describe('validation', () => {
		let loggerWarnSpy: jest.SpyInstance;

		beforeEach(() => {
			loggerWarnSpy = jest
				.spyOn((service as never as Record<string, unknown>).logger as never, 'warn')
				.mockImplementation();
		});

		afterEach(() => {
			loggerWarnSpy?.mockRestore();
		});

		it('should skip rules with invalid channel category', () => {
			const yaml = `
sensors:
  not_a_real_channel:
    alert_type: smoke
    severity: critical
    properties:
      - property: detected
        operator: eq
        value: true
`;
			existsSyncMock.mockReturnValue(true);
			readFileSyncMock.mockReturnValue(yaml as never);

			service.loadAllRules();

			const rules = service.getSensorRules();

			expect(rules.size).toBe(0);
			expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown channel category'));
		});

		it('should skip rules with invalid alert type', () => {
			const yaml = `
sensors:
  smoke:
    alert_type: not_a_real_alert
    severity: critical
    properties:
      - property: detected
        operator: eq
        value: true
`;
			existsSyncMock.mockReturnValue(true);
			readFileSyncMock.mockReturnValue(yaml as never);

			service.loadAllRules();

			const rules = service.getSensorRules();

			expect(rules.size).toBe(0);
			expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown alert type'));
		});

		it('should skip property checks with invalid property category', () => {
			const yaml = `
sensors:
  smoke:
    alert_type: smoke
    severity: critical
    properties:
      - property: not_a_real_property
        operator: eq
        value: true
`;
			existsSyncMock.mockReturnValue(true);
			readFileSyncMock.mockReturnValue(yaml as never);

			service.loadAllRules();

			const rules = service.getSensorRules();

			expect(rules.size).toBe(0);
			expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown property'));
		});

		it('should skip property checks with invalid operator', () => {
			const yaml = `
sensors:
  smoke:
    alert_type: smoke
    severity: critical
    properties:
      - property: detected
        operator: invalid_op
        value: true
`;
			existsSyncMock.mockReturnValue(true);
			readFileSyncMock.mockReturnValue(yaml as never);

			service.loadAllRules();

			const rules = service.getSensorRules();

			expect(rules.size).toBe(0);
			expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown operator'));
		});

		it('should return empty map when builtin file is missing', () => {
			const loggerErrorSpy = jest
				.spyOn((service as never as Record<string, unknown>).logger as never, 'error')
				.mockImplementation();

			existsSyncMock.mockReturnValue(false);

			service.loadAllRules();

			const rules = service.getSensorRules();

			expect(rules.size).toBe(0);
			expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load builtin detection rules'));

			loggerErrorSpy.mockRestore();
		});
	});
});
