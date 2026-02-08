import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { SecurityAlertType, Severity } from '../security.constants';

import {
	DetectionOperator,
	ResolvedPropertyCheck,
	ResolvedSensorRule,
	YamlDetectionRulesConfig,
	YamlPropertyCheck,
	YamlSensorRule,
} from './detection-rules.types';

const VALID_OPERATORS: DetectionOperator[] = ['eq', 'gt', 'gte', 'in'];

@Injectable()
export class DetectionRulesLoaderService implements OnModuleInit {
	private readonly logger = new Logger(DetectionRulesLoaderService.name);

	private sensorRules: Map<string, ResolvedSensorRule> = new Map();

	private readonly builtinSpecPath = join(__dirname, 'definitions');
	private readonly userSpecPath = process.env.SECURITY_SPEC_PATH ?? join(__dirname, '../../../../../../var/security');

	onModuleInit(): void {
		this.loadAllRules();
	}

	loadAllRules(): void {
		this.sensorRules.clear();

		const builtinPath = join(this.builtinSpecPath, 'detection-rules.yaml');
		const userPath = join(this.userSpecPath, 'detection-rules.yaml');

		// Load builtin rules (required)
		const builtinConfig = this.loadYamlFile(builtinPath);

		if (!builtinConfig) {
			this.logger.error('Failed to load builtin detection rules - sensor detection will be unavailable');

			return;
		}

		this.resolveAndMergeRules(builtinConfig);

		// Load user overrides (optional)
		if (existsSync(userPath)) {
			const userConfig = this.loadYamlFile(userPath);

			if (userConfig) {
				this.resolveAndMergeRules(userConfig);
			}
		}

		this.logger.log(`Loaded ${this.sensorRules.size} sensor detection rules`);
	}

	getSensorRules(): Map<string, ResolvedSensorRule> {
		return this.sensorRules;
	}

	private resolveAndMergeRules(config: YamlDetectionRulesConfig): void {
		if (!config.sensors || typeof config.sensors !== 'object') {
			this.logger.warn('Detection rules config has no "sensors" key');

			return;
		}

		for (const [key, rule] of Object.entries(config.sensors)) {
			const resolved = this.resolveRule(key, rule);

			if (resolved) {
				this.sensorRules.set(key, resolved);
			}
		}
	}

	private resolveRule(key: string, rule: YamlSensorRule): ResolvedSensorRule | null {
		// Validate channel category
		const channelCategory = Object.values(ChannelCategory).find((v) => v === (key as ChannelCategory));

		if (!channelCategory) {
			this.logger.warn(`Unknown channel category "${key}" in detection rules, skipping`);

			return null;
		}

		// Validate alert type
		const alertType = Object.values(SecurityAlertType).find((v) => v === (rule.alert_type as SecurityAlertType));

		if (!alertType) {
			this.logger.warn(`Unknown alert type "${rule.alert_type}" for channel "${key}", skipping`);

			return null;
		}

		// Validate severity
		const severity = Object.values(Severity).find((v) => v === (rule.severity as Severity));

		if (!severity) {
			this.logger.warn(`Unknown severity "${rule.severity}" for channel "${key}", skipping`);

			return null;
		}

		// Validate properties
		if (!Array.isArray(rule.properties) || rule.properties.length === 0) {
			this.logger.warn(`No properties defined for channel "${key}", skipping`);

			return null;
		}

		const resolvedProperties: ResolvedPropertyCheck[] = [];

		for (const check of rule.properties) {
			const resolvedCheck = this.resolvePropertyCheck(key, check);

			if (resolvedCheck) {
				resolvedProperties.push(resolvedCheck);
			}
		}

		if (resolvedProperties.length === 0) {
			this.logger.warn(`No valid property checks for channel "${key}", skipping`);

			return null;
		}

		return {
			channelCategory,
			alertType,
			severity,
			properties: resolvedProperties,
		};
	}

	private resolvePropertyCheck(channelKey: string, check: YamlPropertyCheck): ResolvedPropertyCheck | null {
		// Validate property category
		const property = Object.values(PropertyCategory).find((v) => v === (check.property as PropertyCategory));

		if (!property) {
			this.logger.warn(`Unknown property "${check.property}" for channel "${channelKey}", skipping check`);

			return null;
		}

		// Validate operator
		if (!VALID_OPERATORS.includes(check.operator)) {
			this.logger.warn(`Unknown operator "${check.operator}" for channel "${channelKey}", skipping check`);

			return null;
		}

		return {
			property,
			operator: check.operator,
			value: check.value,
		};
	}

	private loadYamlFile(filePath: string): YamlDetectionRulesConfig | null {
		try {
			if (!existsSync(filePath)) {
				return null;
			}

			const content = readFileSync(filePath, 'utf-8');
			const parsed = parseYaml(content) as YamlDetectionRulesConfig;

			this.logger.debug(`Loaded detection rules file: ${filePath}`);

			return parsed;
		} catch (error) {
			this.logger.error(`Failed to load detection rules file ${filePath}: ${error}`);

			return null;
		}
	}
}
