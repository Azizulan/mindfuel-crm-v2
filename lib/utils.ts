import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Shared className helper used by shadcn-style components.
// Imported as `@/lib/utils` thanks to the path alias `@/*` → `./*` in tsconfig.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
