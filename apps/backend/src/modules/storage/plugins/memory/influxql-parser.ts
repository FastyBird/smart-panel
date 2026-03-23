import { InMemoryTimeSeriesStore } from './in-memory-timeseries.store';

interface WhereCondition {
	field: string;
	operator: string;
	value: string;
}

interface AggregationField {
	func: string;
	field: string;
	alias: string;
}

interface ParsedSelect {
	type: 'select';
	fields: string[];
	aggregations: AggregationField[];
	measurement: string;
	retentionPolicy: string | null;
	where: WhereCondition[];
	groupByTag: string | null;
	groupByTime: number | null;
	fillNone: boolean;
	orderDesc: boolean;
	limit: number | null;
}

interface ParsedDelete {
	type: 'delete';
	measurement: string;
	where: WhereCondition[];
}

type ParsedQuery = ParsedSelect | ParsedDelete;

/**
 * Lightweight InfluxQL interpreter that handles the subset of queries
 * used by Smart Panel consumers against the in-memory store.
 *
 * Supported patterns:
 * - SELECT * / fields FROM measurement WHERE ... ORDER BY time LIMIT N
 * - SELECT AGG(field) FROM measurement WHERE ... GROUP BY tag/time(interval)
 * - DELETE FROM measurement WHERE ...
 *
 * NOT supported (returns empty results):
 * - Subqueries, math expressions between aggregations (COUNT + COUNT)
 * - Complex time expressions beyond basic now() - duration
 */
export class InfluxQLParser {
	constructor(private readonly store: InMemoryTimeSeriesStore) {}

	execute<T>(query: string): T[] {
		const normalized = query.trim().replace(/\s+/g, ' ');

		const parsed = this.parse(normalized);

		if (!parsed) {
			return [];
		}

		if (parsed.type === 'delete') {
			return this.executeDelete(parsed) as T[];
		}

		return this.executeSelect<T>(parsed);
	}

	private parse(query: string): ParsedQuery | null {
		const upper = query.toUpperCase().trim();

		if (upper.startsWith('DELETE')) {
			return this.parseDelete(query);
		}

		if (upper.startsWith('SELECT')) {
			return this.parseSelect(query);
		}

		return null;
	}

	private parseSelect(query: string): ParsedSelect | null {
		const q = query.trim().replace(/\s+/g, ' ');

		const fromMatch = q.match(/\bFROM\s+/i);

		if (!fromMatch) {
			return null;
		}

		const fromIdx = fromMatch.index ?? 0;
		const selectPart = q.substring(q.toUpperCase().indexOf('SELECT') + 6, fromIdx).trim();
		const afterFrom = q.substring(fromIdx + fromMatch[0].length);

		const { measurement, retentionPolicy, rest: afterMeasurement } = this.parseFromClause(afterFrom);

		const where = this.parseWhere(afterMeasurement);
		const groupByTag = this.parseGroupByTag(afterMeasurement);
		const groupByTime = this.parseGroupByTime(afterMeasurement);
		const fillNone = /fill\s*\(\s*none\s*\)/i.test(afterMeasurement);
		const orderDesc = this.parseOrderBy(afterMeasurement);
		const limit = this.parseLimit(afterMeasurement);

		const { fields, aggregations } = this.parseSelectFields(selectPart);

		return {
			type: 'select',
			fields,
			aggregations,
			measurement,
			retentionPolicy,
			where,
			groupByTag,
			groupByTime,
			fillNone,
			orderDesc,
			limit,
		};
	}

	private parseDelete(query: string): ParsedDelete | null {
		const q = query.trim().replace(/\s+/g, ' ');

		const fromMatch = q.match(/\bFROM\s+/i);

		if (!fromMatch) {
			return null;
		}

		const deleteFromIdx = fromMatch.index ?? 0;
		const afterFrom = q.substring(deleteFromIdx + fromMatch[0].length);
		const { measurement, rest } = this.parseFromClause(afterFrom);
		const where = this.parseWhere(rest);

		return {
			type: 'delete',
			measurement,
			where,
		};
	}

	private parseFromClause(afterFrom: string): {
		measurement: string;
		retentionPolicy: string | null;
		rest: string;
	} {
		const rpMatch = afterFrom.match(/^"?(\w+)"?\s*\.\s*"?(\w+)"?/);

		if (rpMatch) {
			const rest = afterFrom.substring(rpMatch[0].length).trim();

			return {
				retentionPolicy: rpMatch[1],
				measurement: rpMatch[2],
				rest,
			};
		}

		const simpleMatch = afterFrom.match(/^"?(\w+)"?/);

		if (simpleMatch) {
			const rest = afterFrom.substring(simpleMatch[0].length).trim();

			return {
				retentionPolicy: null,
				measurement: simpleMatch[1],
				rest,
			};
		}

		return { measurement: '', retentionPolicy: null, rest: afterFrom };
	}

	private parseSelectFields(selectPart: string): {
		fields: string[];
		aggregations: AggregationField[];
	} {
		if (selectPart.trim() === '*') {
			return { fields: ['*'], aggregations: [] };
		}

		const fields: string[] = [];
		const aggregations: AggregationField[] = [];

		const parts = this.splitByComma(selectPart);

		for (const part of parts) {
			const trimmed = part.trim();

			const aggMatch = trimmed.match(/^(MEAN|LAST|COUNT|MIN|MAX|SUM)\s*\(\s*"?(\w+)"?\s*\)\s*(?:AS\s+"?(\w+)"?)?$/i);

			if (aggMatch) {
				aggregations.push({
					func: aggMatch[1].toUpperCase(),
					field: aggMatch[2],
					alias: aggMatch[3] ?? aggMatch[2],
				});
				continue;
			}

			if (/COUNT\s*\(/i.test(trimmed) && /\+/.test(trimmed)) {
				const aliasMatch = trimmed.match(/AS\s+"?(\w+)"?\s*$/i);
				const alias = aliasMatch?.[1] ?? 'total';

				const countMatches = [...trimmed.matchAll(/COUNT\s*\(\s*"?(\w+)"?\s*\)/gi)];

				if (countMatches.length > 0) {
					for (const cm of countMatches) {
						aggregations.push({
							func: 'COUNT',
							field: cm[1],
							alias: `__count_${cm[1]}`,
						});
					}

					aggregations.push({
						func: '__SUM_COUNTS',
						field: countMatches.map((cm) => `__count_${cm[1]}`).join(','),
						alias,
					});
				}

				continue;
			}

			const fieldMatch = trimmed.match(/^"?(\w+)"?$/);

			if (fieldMatch) {
				fields.push(fieldMatch[1]);
			}
		}

		return { fields, aggregations };
	}

	private parseWhere(rest: string): WhereCondition[] {
		const whereMatch = rest.match(/\bWHERE\s+([\s\S]*?)(?:\bGROUP\b|\bORDER\b|\bLIMIT\b|$)/i);

		if (!whereMatch) {
			return [];
		}

		const wherePart = whereMatch[1].trim();
		const conditions: WhereCondition[] = [];

		const parts = wherePart.split(/\s+AND\s+/i);

		for (const part of parts) {
			const trimmed = part.trim();

			if (/\bOR\b/i.test(trimmed)) {
				continue;
			}

			const condMatch = trimmed.match(/^"?(\w+)"?\s*(=|!=|>=|<=|>|<)\s*(.+)$/);

			if (condMatch) {
				conditions.push({
					field: condMatch[1],
					operator: condMatch[2],
					value: condMatch[3].trim(),
				});
			}
		}

		return conditions;
	}

	private parseGroupByTag(rest: string): string | null {
		const match = rest.match(/\bGROUP\s+BY\s+([\s\S]*?)(?:\bORDER\b|\bLIMIT\b|$)/i);

		if (!match) {
			return null;
		}

		const groupPart = match[1].trim();

		const parts = this.splitByComma(groupPart);

		for (const part of parts) {
			const trimmed = part.trim();

			if (/^time\s*\(/i.test(trimmed)) {
				continue;
			}

			const tagMatch = trimmed.match(/^"?(\w+)"?$/);

			if (tagMatch) {
				return tagMatch[1];
			}
		}

		return null;
	}

	private parseGroupByTime(rest: string): number | null {
		const match = rest.match(/\bGROUP\s+BY\b[\s\S]*?\btime\s*\(\s*(\d+)([smhd])\s*\)/i);

		if (!match) {
			return null;
		}

		const value = parseInt(match[1], 10);
		const unit = match[2].toLowerCase();

		switch (unit) {
			case 's':
				return value * 1000;
			case 'm':
				return value * 60 * 1000;
			case 'h':
				return value * 60 * 60 * 1000;
			case 'd':
				return value * 24 * 60 * 60 * 1000;
			default:
				return null;
		}
	}

	private parseOrderBy(rest: string): boolean {
		const match = rest.match(/\bORDER\s+BY\s+time\s+(ASC|DESC)/i);

		if (!match) {
			return true;
		}

		return match[1].toUpperCase() === 'DESC';
	}

	private parseLimit(rest: string): number | null {
		const match = rest.match(/\bLIMIT\s+(\d+)/i);

		return match ? parseInt(match[1], 10) : null;
	}

	private executeDelete(parsed: ParsedDelete): unknown[] {
		const tagFilters = this.buildTagFilters(parsed.where);

		this.store.delete(parsed.measurement, tagFilters);

		return [];
	}

	private executeSelect<T>(parsed: ParsedSelect): T[] {
		const measurement = this.resolveMeasurement(parsed.measurement);

		const tagFilters = this.buildTagFilters(parsed.where);

		const { timeFrom, timeTo } = this.buildTimeRange(parsed.where);

		if (parsed.groupByTag && parsed.aggregations.length > 0) {
			const fields = parsed.aggregations.map((a) => a.field);

			const rows = this.store.queryLastGroupBy(measurement, parsed.groupByTag, fields);

			return rows.map((row) => {
				const result: Record<string, unknown> = { ...row };

				for (const agg of parsed.aggregations) {
					if (agg.field !== agg.alias && agg.field in result) {
						result[agg.alias] = result[agg.field];
						delete result[agg.field];
					}
				}

				return result as T;
			});
		}

		if (parsed.groupByTime && parsed.aggregations.length > 0) {
			const rows = this.store.aggregateByTime(
				measurement,
				parsed.aggregations.filter((a) => a.func !== '__SUM_COUNTS'),
				parsed.groupByTime,
				Object.keys(tagFilters).length > 0 ? tagFilters : undefined,
				timeFrom,
				timeTo,
				parsed.fillNone,
			);

			return this.postProcessAggregations(rows, parsed.aggregations) as T[];
		}

		if (parsed.aggregations.length > 0 && !parsed.groupByTag && !parsed.groupByTime) {
			const result = this.store.aggregate(
				measurement,
				parsed.aggregations.filter((a) => a.func !== '__SUM_COUNTS'),
				Object.keys(tagFilters).length > 0 ? tagFilters : undefined,
				timeFrom,
				timeTo,
			);

			if (!result) {
				return [];
			}

			const processed = this.postProcessAggregations([result], parsed.aggregations);

			return processed as T[];
		}

		const points = this.store.query(
			measurement,
			Object.keys(tagFilters).length > 0 ? tagFilters : undefined,
			timeFrom,
			timeTo,
			parsed.orderDesc,
			parsed.limit ?? undefined,
		);

		const selectFields = parsed.fields.includes('*') ? undefined : parsed.fields;

		return points.map((p) => this.store.pointToRow(p, selectFields) as T);
	}

	private postProcessAggregations(
		rows: Array<Record<string, unknown>>,
		aggregations: AggregationField[],
	): Array<Record<string, unknown>> {
		const sumCountsAgg = aggregations.find((a) => a.func === '__SUM_COUNTS');

		if (!sumCountsAgg) {
			return rows;
		}

		const sourceFields = sumCountsAgg.field.split(',');

		return rows.map((row) => {
			let sum = 0;

			for (const field of sourceFields) {
				sum += Number(row[field] ?? 0);
				delete row[field];
			}

			row[sumCountsAgg.alias] = sum;

			return row;
		});
	}

	private resolveMeasurement(measurement: string): string {
		const cqMappings: Record<string, string> = {
			property_value_counts_1m: 'property_value',
			device_status_1m: 'device_status',
			weather_hourly: 'weather',
		};

		return cqMappings[measurement] ?? measurement;
	}

	private buildTagFilters(where: WhereCondition[]): Record<string, string> {
		const filters: Record<string, string> = {};

		for (const cond of where) {
			if (cond.field === 'time') {
				continue;
			}

			if (cond.operator === '=') {
				const value = cond.value.replace(/^'|'$/g, '');

				filters[cond.field] = value;
			}
		}

		return filters;
	}

	private buildTimeRange(where: WhereCondition[]): {
		timeFrom: Date | undefined;
		timeTo: Date | undefined;
	} {
		let timeFrom: Date | undefined;
		let timeTo: Date | undefined;

		for (const cond of where) {
			if (cond.field !== 'time') {
				continue;
			}

			const resolvedTime = this.resolveTimeValue(cond.value);

			if (resolvedTime === null) {
				continue;
			}

			switch (cond.operator) {
				case '>=':
				case '>':
					timeFrom = resolvedTime;
					break;
				case '<=':
				case '<':
					timeTo = resolvedTime;
					break;
			}
		}

		return { timeFrom, timeTo };
	}

	private resolveTimeValue(value: string): Date | null {
		const trimmed = value.trim().replace(/^'|'$/g, '');

		if (/^now\(\)$/i.test(trimmed)) {
			return new Date();
		}

		const nowOffsetMatch = trimmed.match(/^now\(\)\s*-\s*(\d+)([smhd])/i);

		if (nowOffsetMatch) {
			const amount = parseInt(nowOffsetMatch[1], 10);
			const unit = nowOffsetMatch[2].toLowerCase();
			let ms = 0;

			switch (unit) {
				case 's':
					ms = amount * 1000;
					break;
				case 'm':
					ms = amount * 60 * 1000;
					break;
				case 'h':
					ms = amount * 60 * 60 * 1000;
					break;
				case 'd':
					ms = amount * 24 * 60 * 60 * 1000;
					break;
			}

			return new Date(Date.now() - ms);
		}

		const epochMsMatch = trimmed.match(/^(\d+)ms$/);

		if (epochMsMatch) {
			return new Date(parseInt(epochMsMatch[1], 10));
		}

		const isoDate = new Date(trimmed);

		if (!isNaN(isoDate.getTime())) {
			return isoDate;
		}

		return null;
	}

	private splitByComma(str: string): string[] {
		const parts: string[] = [];
		let depth = 0;
		let current = '';

		for (const char of str) {
			if (char === '(') {
				depth++;
			} else if (char === ')') {
				depth--;
			}

			if (char === ',' && depth === 0) {
				parts.push(current);
				current = '';
			} else {
				current += char;
			}
		}

		if (current.trim()) {
			parts.push(current);
		}

		return parts;
	}
}
