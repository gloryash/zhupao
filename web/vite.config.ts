import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudFunctionProxyPlugin } from './server/cloudFunctionProxy'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env / .env.local with no prefix filter so the dev proxy can read the
  // CloudBase env id from the same VITE_CLOUDBASE_ENV the web app uses (Vite
  // does not expose VITE_* vars on process.env for server-side plugin code).
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      cloudFunctionProxyPlugin({ envId: env.VITE_CLOUDBASE_ENV || env.CLOUDBASE_ENV })
    ],
    server: {
      port: 5180,
      host: true
    },
    preview: {
      port: 5180,
      host: true
    }
  }
})
