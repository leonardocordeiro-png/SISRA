import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Expõe a versão do package.json para uso em todo o código como __APP_VERSION__
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  }
})
