# Task: Onboarding wizard UI
ID: FEATURE-ONBOARDING-WIZARD
Type: feature
Scope: admin
Size: medium
Parent: EPIC-APP-ONBOARDING
Status: planned

## 1. Business goal

In order to complete the initial Smart Panel setup easily,
As a new user,
I want a step-by-step wizard that guides me through account creation and basic configuration.

## 2. Context

The admin app needs a dedicated onboarding module with a multi-step wizard interface. This should follow the patterns established in the spaces onboarding wizard (`view-spaces-onboarding.vue`).

**Existing references:**
- `apps/admin/src/modules/spaces/views/view-spaces-onboarding.vue` - Multi-step wizard pattern
- `apps/admin/src/modules/spaces/composables/useSpacesOnboarding.ts` - Wizard state management
- `apps/admin/src/modules/auth/components/sign/sign-up-form.vue` - Account creation form
- `apps/admin/src/modules/weather/` - Location configuration patterns

**Wizard steps:**
1. **Welcome** - Introduction, language selection
2. **Account** - Create owner account (username, password, email, name)
3. **Location** - Configure weather location (optional, can skip)
4. **Integrations** - Enable available plugins (optional, separate task)
5. **Complete** - Summary and "Get Started" button

## 3. Scope

**In scope**

- Create `apps/admin/src/modules/onboarding/` module structure
- Welcome step component with introduction text
- Account creation step (reusing/adapting sign-up form)
- Location configuration step with city search or coordinates
- Completion step with summary and redirect
- `useAppOnboarding()` composable for wizard state
- Onboarding layout component
- Route definitions for `/onboarding`
- Localization strings (English)
- Auto-login after account creation

**Out of scope**

- Router guards (separate task: TECH-ONBOARDING-ROUTER-GUARDS)
- Integrations step (separate task: FEATURE-ONBOARDING-INTEGRATIONS)
- Panel app onboarding
- Multi-language support beyond English

## 4. Acceptance criteria

- [ ] Onboarding module follows existing module structure patterns
- [ ] Welcome step displays introduction and allows proceeding
- [ ] Account step validates input and creates owner via API
- [ ] Location step allows city search or manual coordinates entry
- [ ] Location step can be skipped
- [ ] Complete step shows summary of configured items
- [ ] Clicking "Get Started" marks onboarding complete and redirects to dashboard
- [ ] User is automatically logged in after account creation
- [ ] Wizard state persists during navigation between steps
- [ ] Back navigation works correctly
- [ ] Responsive design for different screen sizes

## 5. Example scenarios

### Scenario: Complete minimal onboarding

Given I am on the onboarding wizard welcome step
When I click "Get Started"
And I fill in username, password, and email
And I click "Create Account"
And I skip the location step
And I click "Finish Setup"
Then my account is created
And I am logged in
And I am redirected to the dashboard

### Scenario: Full onboarding with location

Given I am on the account creation step
When I create my account successfully
And I proceed to the location step
And I search for "Prague" and select it
And I click "Continue"
And I click "Finish Setup"
Then my location is saved
And weather data will use my configured location

### Scenario: Navigate back in wizard

Given I am on the location step
When I click the "Back" button
Then I return to the account step
And my previously entered data is preserved

## 6. Technical constraints

- Follow existing admin module structure
- Use Element Plus components (`el-steps`, `el-card`, `el-button`, etc.)
- Use Vue I18n for all text
- Reuse patterns from spaces onboarding wizard
- Do not modify generated code
- Use existing API client for backend calls

## 7. Implementation hints

**Module structure:**
```
apps/admin/src/modules/onboarding/
├── onboarding.module.ts         # Module registration
├── onboarding.constants.ts      # Route names, step definitions
├── router/
│   └── index.ts                 # Route definitions
├── layouts/
│   └── layout-onboarding.vue    # Wizard layout with steps header
├── views/
│   └── view-onboarding.vue      # Main wizard view
├── components/
│   ├── components.ts            # Barrel export
│   ├── step-welcome.vue         # Welcome step
│   ├── step-account.vue         # Account creation step
│   ├── step-location.vue        # Location configuration step
│   └── step-complete.vue        # Completion step
├── composables/
│   ├── composables.ts           # Barrel export
│   └── useAppOnboarding.ts      # Wizard state management
├── locales/
│   └── en-US.json               # English translations
└── index.ts                     # Public exports
```

**Composable structure (`useAppOnboarding.ts`):**
```typescript
export function useAppOnboarding() {
  const currentStep = ref(0);
  const isLoading = ref(false);

  // Account data
  const accountData = ref({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
  });

  // Location data
  const locationData = ref({
    city: '',
    latitude: null,
    longitude: null,
    timezone: '',
  });

  // Step navigation
  const nextStep = () => { ... };
  const prevStep = () => { ... };

  // API calls
  const createAccount = async () => { ... };
  const saveLocation = async () => { ... };
  const completeOnboarding = async () => { ... };

  return { ... };
}
```

**Route configuration:**
```typescript
export const ModuleOnboardingRoutes: RouteRecordRaw[] = [
  {
    path: '/onboarding',
    name: RouteNames.ONBOARDING,
    component: () => import('../layouts/layout-onboarding.vue'),
    meta: {
      guards: ['onboarding'], // Special guard, no auth required
      title: 'Setup',
    },
    children: [
      {
        path: '',
        name: RouteNames.ONBOARDING_WIZARD,
        component: () => import('../views/view-onboarding.vue'),
      },
    ],
  },
];
```

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- Study the spaces onboarding wizard implementation first
- Reuse sign-up form validation logic
- Keep the UI simple and clean
- Add all text to locales file
- Test step navigation thoroughly
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
