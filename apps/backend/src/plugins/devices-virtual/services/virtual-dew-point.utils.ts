/** Immutable formula contract: Magnus over liquid water, Celsius and percent RH; never clip. */
export const DEW_POINT_FORMULA = 'magnus-water-17.62-243.12-v1' as const;
export type DewPointRole = 'dry_bulb' | 'relative_humidity';
export const DEW_POINT_ROLES: readonly DewPointRole[] = ['dry_bulb', 'relative_humidity'];
export function calculateDewPoint(temperature: number, humidity: number): number | null {
	if (
		!Number.isFinite(temperature) ||
		temperature <= -45 ||
		temperature > 60 ||
		!Number.isFinite(humidity) ||
		humidity <= 0 ||
		humidity > 100
	)
		return null;
	const gamma = Math.log(humidity / 100) + (17.62 * temperature) / (243.12 + temperature);
	const result = (243.12 * gamma) / (17.62 - gamma);
	return Number.isFinite(result) && result > -45 && result <= 60 ? result : null;
}

export const dewPointInputDomain = (role: DewPointRole) =>
	Object.freeze({
		minimum: role === 'dry_bulb' ? -45 : 0,
		minimumExclusive: true,
		maximum: role === 'dry_bulb' ? 60 : 100,
	});
