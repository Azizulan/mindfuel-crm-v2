import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose. That file is a leftover from the
// pre-Next.js setup and pulls in @vitejs/plugin-react + @tailwindcss/vite,
// neither of which is installed any more — vitest picking it up automatically
// is why the suite was failing to start at all.
//
// The suite is pure logic (queue scoring), so it needs no React or CSS
// pipeline. Point vitest here and skip vite.config.ts entirely.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
