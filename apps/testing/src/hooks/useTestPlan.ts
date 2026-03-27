import yaml from 'js-yaml';
import { useEffect, useState } from 'react';

import type { TestPlanYaml } from '../types';

interface UseTestPlanResult {
	testPlan: TestPlanYaml | null;
	loading: boolean;
	error: string | null;
}

export function useTestPlan(): UseTestPlanResult {
	const [testPlan, setTestPlan] = useState<TestPlanYaml | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch('/test-plan.yaml')
			.then((res) => {
				if (!res.ok) throw new Error(`Failed to load test plan: ${res.status}`);
				return res.text();
			})
			.then((text) => {
				const parsed = yaml.load(text) as TestPlanYaml;
				if (!parsed.version || !parsed.phases || !parsed.integrations) {
					throw new Error('Invalid test plan: missing version, integrations, or phases');
				}
				setTestPlan(parsed);
			})
			.catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
			.finally(() => setLoading(false));
	}, []);

	return { testPlan, loading, error };
}
