import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const SOURCE_PATH = path.resolve(__dirname, '../../../entrypoints/bm-capture.content.ts');

describe('bm-capture.content.ts scope regression', () => {
  it('safeGet and safeSet are declared at module scope', () => {
    const source = fs.readFileSync(SOURCE_PATH, 'utf-8');
    const sourceFile = ts.createSourceFile(
      SOURCE_PATH,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const topLevelNames = new Set<string>();
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        topLevelNames.add(node.name.text);
      }
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name)) {
            topLevelNames.add(decl.name.text);
          }
        });
      }
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          clause.namedBindings.elements.forEach((el) => {
            topLevelNames.add(el.name.text);
          });
        }
        if (clause?.name) {
          topLevelNames.add(clause.name.text);
        }
      }
    });

    expect(topLevelNames.has('safeGet')).toBe(true);
    expect(topLevelNames.has('safeSet')).toBe(true);
  });

  it('module-scope loadReminderState only references available bindings', () => {
    // This is a lightweight guard against re-introducing the bug where a
    // module-scope function called a helper that was only defined inside
    // main(). If loadReminderState references an identifier that is not
    // available at module scope, the runtime ReferenceError will return.
    const source = fs.readFileSync(SOURCE_PATH, 'utf-8');
    const sourceFile = ts.createSourceFile(
      SOURCE_PATH,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const topLevelNames = new Set<string>();
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        topLevelNames.add(node.name.text);
      }
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name)) {
            topLevelNames.add(decl.name.text);
          }
        });
      }
      if (ts.isInterfaceDeclaration(node) && node.name) {
        topLevelNames.add(node.name.text);
      }
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          clause.namedBindings.elements.forEach((el) => {
            topLevelNames.add(el.name.text);
          });
        }
        if (clause?.name) {
          topLevelNames.add(clause.name.text);
        }
      }
    });

    // Known globals / built-ins used by module-scope code in this file.
    const allowedGlobals = new Set([
      'console',
      'document',
      'window',
      'globalThis',
      'Date',
      'Math',
      'Number',
      'Object',
      'Promise',
      'Set',
      'Map',
      'Array',
      'String',
      'Error',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'AudioContext',
      'localStorage',
      'performance',
      'fetch',
      'encodeURIComponent',
      'JSON',
      'chrome',
      'browser',
    ]);

    const loadReminderState = sourceFile.statements.find(
      (s): s is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(s) && s.name?.text === 'loadReminderState',
    );
    expect(loadReminderState).toBeDefined();

    const collectIdentifiers = (node: ts.Node, out: string[]) => {
      if (ts.isIdentifier(node)) {
        out.push(node.text);
        return;
      }
      // Avoid recursing into nested function declarations — their bodies have
      // their own scope and are checked by the compiler.
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        return;
      }
      ts.forEachChild(node, (child) => collectIdentifiers(child, out));
    };

    const identifiers: string[] = [];
    collectIdentifiers(loadReminderState!, identifiers);

    const violations = identifiers.filter(
      (id) => !topLevelNames.has(id) && !allowedGlobals.has(id),
    );

    expect(violations).toEqual([]);
  });
});
