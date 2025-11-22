/**
 * Wrapper module for the shellies library (CommonJS package)
 * The shellies package is a legacy CommonJS module without ESM/TypeScript support.
 * This wrapper isolates the require() usage to a single location, keeping the rest of the codebase clean.
 *
 * Note: Using require() here is necessary and intentional for this legacy package.
 */
import type { ShelliesLibrary } from '../interfaces/shellies.interface';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- shellies is a CommonJS-only package
const shellies = require('shellies') as ShelliesLibrary;

export default shellies;
