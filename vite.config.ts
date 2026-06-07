import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import vinext from 'vinext'
import { defineConfig } from 'vite'

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    allowedHosts: ['colab-locks-podcast.git4ta.fun', 'all'],
  },
  plugins: [
    tailwindcss(),
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      remoteBindings: false,
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
})
