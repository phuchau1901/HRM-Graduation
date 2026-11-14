import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => ({ plugins: [react()], server: { host: '127.0.0.1', proxy: { '/api': { target: loadEnv(mode, process.cwd(), '').VITE_API_TARGET || 'https://localhost:7041', changeOrigin: true, secure: mode !== 'development' } } }, test: { environment: 'jsdom', restoreMocks: true } }));
