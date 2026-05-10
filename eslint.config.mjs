import antfu from '@antfu/eslint-config'
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss'

const projectClassNamePatterns = [
  '^theme-(?:blue|pink|purple|green|yellow|orange|red)$',
]

export default antfu({
  formatters: true,
  react: true,

  pnpm: false,
  ignores: [
    'components/ui/**/*',
    'cloudflare-env.d.ts',
    '.codex/**/*',
  ],
  rules: {
    'no-console': ['error', { allow: ['info', 'table', 'warn', 'error'] }],
    'react-refresh/only-export-components': 'off',
  },
}, {
  plugins: {
    'better-tailwindcss': eslintPluginBetterTailwindcss,
  },
  settings: {
    'better-tailwindcss': {
      entryPoint: './app/globals.css',
      detectComponentClasses: true,
    },
  },
  rules: {
    ...eslintPluginBetterTailwindcss.configs['recommended-warn'].rules,
    'better-tailwindcss/no-unknown-classes': [
      'warn',
      {
        ignore: projectClassNamePatterns,
      },
    ],
  },
})
