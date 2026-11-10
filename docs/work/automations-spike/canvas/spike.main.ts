// THROWAWAY SPIKE (AU-0): standalone entry so the canvas renders without the backend (no auth, router, stores).
// Uses the same global styles and UnoCSS as app.main.ts.
import { createApp } from 'vue';

import 'virtual:uno.css';

import './assets/styles/base.scss';
import { ViewAutomationSpike } from './modules/automations-spike';

createApp(ViewAutomationSpike).mount('#app');
