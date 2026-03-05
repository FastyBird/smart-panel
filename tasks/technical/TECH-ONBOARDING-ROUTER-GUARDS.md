# Task: Router guards for onboarding flow
ID: TECH-ONBOARDING-ROUTER-GUARDS
Type: technical
Scope: admin
Size: small
Parent: EPIC-APP-ONBOARDING
Status: planned

## 1. Business goal

In order to ensure new users complete setup before using the application,
As the admin application,
I want router guards that redirect to onboarding when no owner exists.

## 2. Context

The admin app needs to detect fresh installations and redirect users to the onboarding wizard instead of the login page. This requires:
- Checking onboarding status from backend before routing decisions
- New guard for onboarding routes
- Modified guard chain for authenticated routes

**Existing guards:**
- `anonymousGuard` - Redirects authenticated users away from sign-in/sign-up
- `authenticatedGuard` - Redirects unauthenticated users to sign-in
- `sessionGuard` - Session initialization hook

**Desired flow:**
```
[Any route]
  → Check /system/onboarding (cached)
  → If !hasOwner → redirect to /onboarding
  → If hasOwner && onboardingCompleted
    → Continue to normal guard chain
  → If hasOwner && !onboardingCompleted && authenticated
    → Optionally show "complete onboarding" prompt
```

## 3. Scope

**In scope**

- Add `onboardingGuard` that checks onboarding status
- Add composable/store for caching onboarding status
- Modify router initialization to check onboarding first
- Handle onboarding route protection (only accessible when needed)
- Redirect to dashboard after onboarding completion

**Out of scope**

- Backend endpoint (FEATURE-ONBOARDING-BACKEND)
- Wizard UI (FEATURE-ONBOARDING-WIZARD)
- Complex onboarding state machine

## 4. Acceptance criteria

- [ ] Fresh installation redirects to `/onboarding` from any route
- [ ] After owner exists, normal auth flow applies
- [ ] Onboarding route is not accessible after completion
- [ ] Onboarding status is cached to avoid repeated API calls
- [ ] Cache is invalidated after account creation
- [ ] Guard works correctly on page refresh

## 5. Example scenarios

### Scenario: Fresh installation - first visit

Given a fresh installation with no owner
When I navigate to `/`
Then I am redirected to `/onboarding`
And the login page is not shown

### Scenario: Fresh installation - direct login attempt

Given a fresh installation with no owner
When I navigate directly to `/sign/in`
Then I am redirected to `/onboarding`

### Scenario: After onboarding - login required

Given onboarding is completed and I am logged out
When I navigate to `/`
Then I am redirected to `/sign/in`
And the onboarding wizard is not shown

### Scenario: Onboarding route after completion

Given onboarding is completed
When I navigate directly to `/onboarding`
Then I am redirected to `/` (or login if not authenticated)

## 6. Technical constraints

- Must not break existing guard chain
- Minimize API calls (cache onboarding status)
- Handle offline/error states gracefully
- Work with existing session management

## 7. Implementation hints

**Onboarding store (`apps/admin/src/modules/onboarding/store/onboarding.store.ts`):**
```typescript
export const useOnboardingStore = defineStore('onboarding-status', () => {
  const status = ref<OnboardingStatus | null>(null);
  const isLoading = ref(false);
  const lastFetched = ref<Date | null>(null);

  const fetchStatus = async (force = false) => {
    // Cache for 5 minutes unless forced
    if (!force && status.value && lastFetched.value) {
      const age = Date.now() - lastFetched.value.getTime();
      if (age < 5 * 60 * 1000) return status.value;
    }

    isLoading.value = true;
    try {
      const response = await backendClient.get('/system/onboarding');
      status.value = response.data;
      lastFetched.value = new Date();
      return status.value;
    } finally {
      isLoading.value = false;
    }
  };

  const invalidate = () => {
    status.value = null;
    lastFetched.value = null;
  };

  const needsOnboarding = computed(() =>
    status.value && !status.value.hasOwner
  );

  return { status, isLoading, fetchStatus, invalidate, needsOnboarding };
});
```

**Onboarding guard (`apps/admin/src/modules/onboarding/router/guards/onboarding.guard.ts`):**
```typescript
export async function onboardingGuard(
  to: RouteLocationNormalized,
): Promise<boolean | RouteLocationRaw> {
  const onboardingStore = useOnboardingStore();

  try {
    await onboardingStore.fetchStatus();
  } catch {
    // If can't reach backend, allow navigation
    return true;
  }

  const isOnboardingRoute = to.path.startsWith('/onboarding');
  const needsOnboarding = onboardingStore.needsOnboarding;

  // Needs onboarding but not on onboarding route
  if (needsOnboarding && !isOnboardingRoute) {
    return { name: RouteNames.ONBOARDING };
  }

  // Doesn't need onboarding but on onboarding route
  if (!needsOnboarding && isOnboardingRoute) {
    return { name: AppRouteNames.ROOT };
  }

  return true;
}
```

**Integration in auth module:**
```typescript
// In auth.module.ts, add before other guards:
options.router.beforeEach(async (to) => {
  return await onboardingGuard(to);
});
```

## 8. AI instructions

- Read this file entirely before making any code changes
- Study existing guard implementations first
- Implement onboarding store before guards
- Test all navigation scenarios
- Handle network errors gracefully
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
