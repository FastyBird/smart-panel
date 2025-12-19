import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
    plugins: [vue()],
    build: {
        lib: {
            entry: 'assets/index.ts',
            name: 'ExampleAdminExtension',
            formats: ['es'],
            fileName: () => 'index.js',
        },
        outDir: 'admin',
        emptyOutDir: true,
        rollupOptions: {
            external: ['vue'],
        },
    },
});
//# sourceMappingURL=vite.config.js.map