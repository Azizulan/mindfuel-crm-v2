// cPanel / Passenger entry point
// tsx handles TypeScript at runtime — no compile step needed.
import { register } from 'tsx/esm/api';
register();
await import('./server.ts');
