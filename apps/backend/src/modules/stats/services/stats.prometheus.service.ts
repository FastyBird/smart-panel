import { instanceToPlain } from 'class-transformer';

import { Injectable } from '@nestjs/common';

import { StatsAggregatorService } from './stats-aggregator.service';

type PlainObject = Record<string, unknown>;
type StatLeaf = { value: unknown; last_updated?: unknown };

@Injectable()
export class PrometheusExporterService {
	constructor(private readonly agg: StatsAggregatorService) {}

	async getMetrics(): Promise<string> {
		const all = await this.agg.getAll();

		const lines: string[] = [];
		const emitted = new Set<string>();

		const emitGauge = (name: string, help: string, value: number): void => {
			if (!emitted.has(name)) {
				lines.push(`# HELP ${name} ${help}`);
				lines.push(`# TYPE ${name} gauge`);

				emitted.add(name);
			}
			lines.push(`${name} ${value}`);
		};

		const walk = (moduleName: string, obj: unknown, path: string[] = []) => {
			if (!this.isPlainObject(obj)) {
				return;
			}

			for (const [key, raw] of Object.entries(obj)) {
				const seg = this.sanitizeSegment(key);
				const nextPath = [...path, seg];

				if (this.isStatLeaf(raw)) {
					const numeric = this.toNumericValue(raw.value);

					if (numeric !== null) {
						const metric = this.makeMetricName(['fastybird', moduleName, ...nextPath]);
						const help = `${seg} metric for ${moduleName}`;

						emitGauge(metric, help, numeric);
					}

					const ts = this.toUnixSeconds(raw.last_updated);

					if (ts !== null) {
						const tsMetric = this.makeMetricName(['fastybird', moduleName, ...nextPath, 'last_updated_seconds']);
						const tsHelp = `${seg} last update time (unix seconds) for ${moduleName}`;

						emitGauge(tsMetric, tsHelp, ts);
					}

					continue;
				}

				if (this.isPlainObject(raw)) {
					walk(moduleName, raw, nextPath);
				}
			}
		};

		for (const [moduleName, stats] of Object.entries(all)) {
			if (!this.isPlainObject(stats)) {
				continue;
			}

			walk(this.sanitizeSegment(moduleName), instanceToPlain(stats));

			lines.push('');
		}

		return lines.join('\n');
	}

	private isPlainObject(v: unknown): v is PlainObject {
		return typeof v === 'object' && v !== null && !Array.isArray(v);
	}

	private isStatLeaf(v: unknown): v is StatLeaf {
		return this.isPlainObject(v) && 'value' in v;
	}

	private toNumericValue(v: unknown): number | null {
		if (typeof v === 'number' && Number.isFinite(v)) {
			return v;
		}

		if (typeof v === 'boolean') {
			return v ? 1 : 0;
		}

		return null;
	}

	private toUnixSeconds(v: unknown): number | null {
		if (!v) {
			return null;
		}

		if (v instanceof Date) {
			return Math.floor(v.getTime() / 1000);
		}

		if (typeof v === 'string') {
			const d = new Date(v);
			const t = d.getTime();

			return Number.isFinite(t) ? Math.floor(t / 1000) : null;
		}

		return null;
	}

	private sanitizeSegment(s: string): string {
		return s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
	}

	private makeMetricName(parts: string[]): string {
		return this.sanitizeSegment(parts.filter(Boolean).join('_'));
	}
}
