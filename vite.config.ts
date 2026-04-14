import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env instead of just `VITE_` ones.
  const env = loadEnv(mode, process.cwd(), '');
  const SERVER_PORT = parseInt(env.SERVER_PORT || '3000', 10);
  const CLIENT_PORT = parseInt(env.CLIENT_PORT || '5173', 10);

  return {
    plugins: [react()],
    root: 'src/frontend',
    base: '/',
    build: {
      outDir: '../../dist/frontend',
      emptyOutDir: true,
    },
    server: {
      port: CLIENT_PORT,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://localhost:${SERVER_PORT}`,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src/frontend'),
      },
    },
  };
});
