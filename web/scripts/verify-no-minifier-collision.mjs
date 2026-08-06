#!/usr/bin/env node
/**
 * Post-build guard against minifier identifier collisions.
 *
 * The default Rolldown/esbuild minifier in WXT/Vite can assign the same
 * mangled single-letter name to both a top-level constant (e.g. the imported
 * SALE_TIME_DEFAULT object) and a top-level helper function in the bundled
 * IIFE. After the var initializer runs, the function binding is overwritten,
 * so any later call to the helper throws at runtime.
 *
 * This script scans the top-level scope of the content script and background
 * bundles and fails the build if the same identifier is declared as a function
 * and also assigned an object/primitive literal at the same scope.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const outDir = 'output/chrome-mv3';

function collectJsFiles(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      result.push(full);
    }
  }
  return result;
}

function findCollisions(code) {
  const topLevelFunctions = new Set();
  const topLevelAssignments = new Set();

  let depth = 0;
  let inString = null; // ' or ` or "
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1] || '';

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      // Skip to end of line
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      // Skip block comment
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i++;
      continue;
    }

    if (ch === '{' || ch === '(' || ch === '[') {
      depth++;
      continue;
    }
    if (ch === '}' || ch === ')' || ch === ']') {
      depth--;
      continue;
    }

    if (depth !== 0) continue;

    // At top-level scope: look for function declarations like `function X(`
    const fnMatch = code.slice(i).match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (fnMatch) {
      topLevelFunctions.add(fnMatch[1]);
      i += fnMatch[0].length - 1;
      continue;
    }

    // Look for assignments to an object literal like `X={` or `,X={`
    const assignMatch = code.slice(i).match(/^([A-Za-z_$][\w$]*)\s*=\s*\{/);
    if (assignMatch) {
      topLevelAssignments.add(assignMatch[1]);
      i += assignMatch[0].length - 1;
      continue;
    }
  }

  return [...topLevelFunctions].filter((name) => topLevelAssignments.has(name));
}

const files = collectJsFiles(outDir);
let failed = false;

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  const collisions = findCollisions(code);
  if (collisions.length > 0) {
    failed = true;
    console.error(
      `❌ ${relative(outDir, file)}: minifier collision detected for identifier(s): ${collisions.join(', ')}`
    );
  }
}

if (failed) {
  console.error(
    '\nA top-level function and a top-level literal assignment share the same name.\n' +
      'This usually means the minifier corrupted runtime semantics.\n' +
      'Check wxt.config.ts minifier settings (keep_fnames / terser).'
  );
  process.exit(1);
}

console.log('✅ No minifier identifier collisions detected in bundled JS.');
