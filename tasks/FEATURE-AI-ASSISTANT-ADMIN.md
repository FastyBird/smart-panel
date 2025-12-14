# Task: AI Assistant Admin Configuration UI
ID: FEATURE-AI-ASSISTANT-ADMIN
Type: feature
Scope: admin
Size: small
Parent: FEATURE-AI-ASSISTANT
Status: planned

## 1. Business goal

In order to configure the AI assistant's behavior and service providers
As an administrator
I want a settings page where I can enable/disable the assistant, choose providers for each service (LLM, STT, TTS, Wake Word), and configure API keys

## 2. Context

- Follow existing admin module patterns in `src/modules/`
- Use Element Plus components for UI consistency
- Use existing API client patterns for backend communication
- Similar configuration UI exists for weather module
- Support the multi-hybrid architecture (each service independently configurable)

### Reference Files

- `apps/admin/src/modules/weather/` - Settings module pattern
- `apps/admin/src/modules/config/` - Configuration management
- `apps/admin/src/common/api/` - API client usage

## 3. Scope

**In scope**

- Assistant settings Vue page/view
- Provider selection dropdowns for each service
- API key input fields with show/hide toggle
- Local provider configuration (URLs, model selection)
- Connection/validation status indicators
- Test buttons for each provider
- Save/cancel functionality
- Form validation

**Out of scope**

- Conversation history viewing (future enhancement)
- Custom intent/command mapping (future enhancement)
- Usage statistics/analytics (future enhancement)
- Wake word training UI

## 4. Acceptance criteria

- [ ] New "AI Assistant" section in admin navigation
- [ ] Enable/disable toggle for assistant feature
- [ ] LLM provider selection with provider-specific config fields
- [ ] STT provider selection with provider-specific config fields
- [ ] TTS provider selection with provider-specific config fields
- [ ] Wake Word provider selection with config fields
- [ ] API keys masked by default with reveal toggle
- [ ] "Test Connection" button for each provider
- [ ] Visual feedback for connection status (success/error)
- [ ] Form validation for required fields
- [ ] Settings persist after save
- [ ] Responsive layout for different screen sizes

## 5. Example scenarios

### Scenario: Configure hybrid setup

Given the admin opens Assistant Settings
When they select "Ollama" for LLM provider
And enter "http://localhost:11434" as Ollama URL
And select "OpenAI Whisper" for STT provider
And enter their OpenAI API key
And select "Piper" for TTS provider
And click "Test All Connections"
Then each provider shows success/failure status
And they can save the configuration

### Scenario: Disable a service

Given STT is configured with OpenAI
When the admin changes STT provider to "Disabled"
Then the STT configuration fields are hidden
And the assistant will only accept text input

### Scenario: Invalid configuration

Given the admin selects "OpenAI" for LLM
When they leave the API key field empty
And click "Save"
Then validation error shows for API key field
And save is prevented

## 6. Technical constraints

- Use Vue 3 Composition API
- Use Pinia store for state management
- Use Element Plus form components
- Follow existing i18n patterns for labels
- API calls use existing OpenAPI-generated client
- Handle loading states during API calls
- Validate API keys format where possible

## 7. Implementation hints

### File Structure

```
apps/admin/src/modules/assistant/
├── views/
│   └── AssistantSettingsView.vue
├── components/
│   ├── LLMProviderConfig.vue
│   ├── STTProviderConfig.vue
│   ├── TTSProviderConfig.vue
│   ├── WakeWordConfig.vue
│   ├── ProviderStatusBadge.vue
│   └── ApiKeyInput.vue
├── stores/
│   └── assistant.store.ts
├── composables/
│   └── useAssistantConfig.ts
└── locales/
    └── en.json
```

### Provider Configuration Component Pattern

```vue
<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>🧠 Language Model (LLM)</span>
        <ProviderStatusBadge :status="llmStatus" />
      </div>
    </template>

    <el-form-item label="Provider">
      <el-select v-model="config.llm.provider">
        <el-option label="Ollama (Local)" value="ollama" />
        <el-option label="OpenAI" value="openai" />
        <el-option label="Anthropic Claude" value="anthropic" />
        <el-option label="Google Gemini" value="google" />
        <el-option label="Disabled" value="disabled" />
      </el-select>
    </el-form-item>

    <!-- Ollama-specific config -->
    <template v-if="config.llm.provider === 'ollama'">
      <el-form-item label="Ollama URL">
        <el-input v-model="config.llm.ollamaUrl" placeholder="http://localhost:11434" />
      </el-form-item>
      <el-form-item label="Model">
        <el-select v-model="config.llm.ollamaModel">
          <el-option label="Llama 3.2 3B" value="llama3.2:3b" />
          <el-option label="Mistral 7B" value="mistral" />
          <el-option label="Phi-3 Mini" value="phi3" />
        </el-select>
      </el-form-item>
    </template>

    <!-- OpenAI-specific config -->
    <template v-if="config.llm.provider === 'openai'">
      <el-form-item label="API Key">
        <ApiKeyInput v-model="config.llm.openaiApiKey" />
      </el-form-item>
      <el-form-item label="Model">
        <el-select v-model="config.llm.openaiModel">
          <el-option label="GPT-4o Mini" value="gpt-4o-mini" />
          <el-option label="GPT-4o" value="gpt-4o" />
        </el-select>
      </el-form-item>
    </template>

    <el-button @click="testConnection" :loading="testing">
      Test Connection
    </el-button>
  </el-card>
</template>
```

### API Key Input Component

```vue
<template>
  <el-input
    :type="showKey ? 'text' : 'password'"
    v-model="modelValue"
    placeholder="Enter API key"
  >
    <template #append>
      <el-button @click="showKey = !showKey">
        <el-icon>
          <View v-if="!showKey" />
          <Hide v-else />
        </el-icon>
      </el-button>
    </template>
  </el-input>
</template>
```

### Store Pattern

```typescript
// stores/assistant.store.ts
export const useAssistantStore = defineStore('assistant', () => {
  const config = ref<AssistantConfig | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchConfig() {
    loading.value = true;
    try {
      const response = await api.assistant.getConfig();
      config.value = response.data;
    } catch (e) {
      error.value = 'Failed to load assistant configuration';
    } finally {
      loading.value = false;
    }
  }

  async function saveConfig(newConfig: AssistantConfig) {
    loading.value = true;
    try {
      await api.assistant.updateConfig(newConfig);
      config.value = newConfig;
    } catch (e) {
      error.value = 'Failed to save configuration';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function testProvider(type: 'llm' | 'stt' | 'tts', providerConfig: any) {
    const response = await api.assistant.testProvider({ type, config: providerConfig });
    return response.data.success;
  }

  return { config, loading, error, fetchConfig, saveConfig, testProvider };
});
```

### Navigation Registration

```typescript
// Add to router
{
  path: '/assistant',
  name: 'assistant-settings',
  component: () => import('@/modules/assistant/views/AssistantSettingsView.vue'),
  meta: { title: 'AI Assistant', icon: 'Robot' }
}
```

## 8. AI instructions (for Junie / AI)

- Read FEATURE-AI-ASSISTANT.md first for full context
- Look at weather module settings as reference implementation
- Start with basic form layout, then add provider switching
- Use existing Element Plus patterns from other modules
- Implement validation before save functionality
- Test connection feature requires backend endpoint (mock if needed)
- Keep provider configs in separate components for maintainability
- Add i18n keys for all user-facing strings
