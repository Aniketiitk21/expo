/**
 * Codemod: Replace @react-navigation/* imports with expo-router equivalents.
 *
 * Mapping:
 *   @react-navigation/native        → expo-router
 *   @react-navigation/stack         → expo-router/js-stack
 *   @react-navigation/bottom-tabs   → expo-router/js-tabs
 *   @react-navigation/material-top-tabs → expo-router/js-top-tabs
 *
 * After replacement, duplicate `expo-router` imports are merged into one.
 */
import type {
  ASTPath,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  JSCodeshift,
  Transform,
} from 'jscodeshift';

type AnyImportSpecifier = ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier;

// `importKind` lives on Babel/jscodeshift import nodes but isn't in the base
// `@types/jscodeshift` typings. `ImportKindAware<T>` extends any node type with
// that optional field, and `isImportKindAware` narrows to it so call sites can
// read and write `importKind` without per-site `as` casts.
type ImportKindAware<T> = T & { importKind?: 'type' | 'value' };

const isImportKindAware = <T extends object>(node: T): node is ImportKindAware<T> =>
  node !== null && node !== undefined;

const IMPORT_MAP: Record<string, string> = {
  '@react-navigation/native': 'expo-router',
  '@react-navigation/stack': 'expo-router/js-stack',
  '@react-navigation/bottom-tabs': 'expo-router/js-tabs',
  '@react-navigation/material-top-tabs': 'expo-router/js-top-tabs',
};

const UNSUPPORTED_SPECIFIERS: Partial<Record<AnyImportSpecifier['type'], string>> = {
  ImportDefaultSpecifier: 'default import',
  ImportNamespaceSpecifier: 'namespace import (import * as ...)',
};

const sourceOf = (path: ASTPath<ImportDeclaration>): string => String(path.node.source.value);

const lineOf = (path: ASTPath<ImportDeclaration>): number | 'unknown' =>
  path.node.loc ? path.node.loc.start.line : 'unknown';

const isMappable = (path: ASTPath<ImportDeclaration>): boolean =>
  IMPORT_MAP[sourceOf(path)] !== undefined;

const isTypeSpecifier = (spec: AnyImportSpecifier): boolean =>
  isImportKindAware(spec) && spec.importKind === 'type';

const isTypeOnlyImport = (path: ASTPath<ImportDeclaration>): boolean =>
  isImportKindAware(path.node) && path.node.importKind === 'type';

// Recast caches each node's source text and reprints from that cache when the
// node reference looks unchanged. When we swap in specifiers that differ only
// in metadata (e.g. a specifier that had a displaced `type` modifier), the
// cached source would still carry the old modifier. Clearing `original` forces
// recast to print fresh from the AST.
const forceReprint = (node: ImportDeclaration): void => {
  (node as { original?: unknown }).original = null;
};

// Clone a specifier with an inline `type` modifier: `import { type A }`. Inline
// `type` marks a single specifier as type-only while letting the rest of the
// declaration carry value specifiers — needed when we merge an `import type`
// declaration into a value declaration that also brings in values. Clones
// instead of mutating so the original specifier (on a declaration that will be
// removed) isn't altered mid-transform.
const markAsInlineType = <T extends AnyImportSpecifier>(spec: T): T => {
  const clone = { ...spec };
  if (isImportKindAware(clone)) clone.importKind = 'type';
  return clone;
};

const collectUnsupportedErrors = (
  filePath: string,
  paths: ASTPath<ImportDeclaration>[]
): string[] => {
  const errors: string[] = [];
  for (const path of paths) {
    const specifiers = (path.node.specifiers ?? []) as AnyImportSpecifier[];
    for (const spec of specifiers) {
      const label = UNSUPPORTED_SPECIFIERS[spec.type];
      if (!label) continue;
      errors.push(
        `${filePath}:${lineOf(path)} - ${label} from "${sourceOf(path)}" is not supported. ` +
          `Replace with named imports before running this codemod.`
      );
    }
  }
  return errors;
};

type DedupeResult = {
  specifiers: AnyImportSpecifier[];
  valueDisplacedType: boolean;
};

// Deduplicate specifiers by local binding name; value wins over type.
// `valueDisplacedType` lets the caller invalidate recast's cached source.
const dedupeByLocalName = (specifiers: AnyImportSpecifier[]): DedupeResult => {
  // `local?.name` is typed as `string | IdentifierKind | undefined` — Map with
  // an `unknown` key preserves the identity/equality semantics the original
  // `find` used (strings compared by value, objects by reference).
  const byName = new Map<unknown, AnyImportSpecifier>();
  let valueDisplacedType = false;

  for (const spec of specifiers) {
    const key = spec.local?.name;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, spec);
      continue;
    }
    if (isTypeSpecifier(existing) && !isTypeSpecifier(spec)) {
      byName.set(key, spec);
      valueDisplacedType = true;
    }
  }

  return { specifiers: [...byName.values()], valueDisplacedType };
};

const groupPathsBySource = (
  paths: ASTPath<ImportDeclaration>[]
): Map<string, ASTPath<ImportDeclaration>[]> => {
  const groups = new Map<string, ASTPath<ImportDeclaration>[]>();
  for (const path of paths) {
    const source = sourceOf(path);
    const existing = groups.get(source);
    if (existing) {
      existing.push(path);
    } else {
      groups.set(source, [path]);
    }
  }
  return groups;
};

// Flatten every specifier across the group's declarations into one list.
// When the group mixes `import type` with value imports, specifiers that came
// from a type-only declaration get an inline `type` modifier so their type-only
// nature survives the merge into the single (value) keeper.
const collectSpecifiers = (
  groupPaths: ASTPath<ImportDeclaration>[],
  mixesTypeAndValueImports: boolean
): AnyImportSpecifier[] => {
  const out: AnyImportSpecifier[] = [];
  for (const path of groupPaths) {
    const specs = (path.node.specifiers ?? []) as AnyImportSpecifier[];
    if (mixesTypeAndValueImports && isTypeOnlyImport(path)) {
      for (const spec of specs) out.push(markAsInlineType(spec));
    } else {
      for (const spec of specs) out.push(spec);
    }
  }
  return out;
};

const mergeGroup = (j: JSCodeshift, groupPaths: ASTPath<ImportDeclaration>[]): void => {
  const hasAnyTypeOnlyImport = groupPaths.some(isTypeOnlyImport);
  const allImportsAreTypeOnly = groupPaths.every(isTypeOnlyImport);
  // Mixed: `import type { A }` + `import { B }` → `import { type A, B }`.
  const mixesTypeAndValueImports = hasAnyTypeOnlyImport && !allImportsAreTypeOnly;

  const [keeper, ...rest] = groupPaths;
  if (!keeper) return;
  const { specifiers, valueDisplacedType } = dedupeByLocalName(
    collectSpecifiers(groupPaths, mixesTypeAndValueImports)
  );

  keeper.node.specifiers = specifiers;
  if (mixesTypeAndValueImports && isImportKindAware(keeper.node)) {
    keeper.node.importKind = 'value';
  }
  if (valueDisplacedType) forceReprint(keeper.node);

  for (const path of rest) j(path).remove();
};

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const mappablePaths = root
    .find(j.ImportDeclaration)
    .filter((path) => isMappable(path))
    .paths();

  if (mappablePaths.length === 0) return undefined;

  const errors = collectUnsupportedErrors(fileInfo.path, mappablePaths);
  if (errors.length > 0) {
    throw new Error(`Unsupported import style(s) found:\n${errors.join('\n')}`);
  }

  for (const path of mappablePaths) {
    path.node.source.value = IMPORT_MAP[sourceOf(path)];
  }

  const groups = groupPathsBySource(root.find(j.ImportDeclaration).paths());
  for (const groupPaths of groups.values()) {
    if (groupPaths.length > 1) mergeGroup(j, groupPaths);
  }

  return root.toSource();
};

export default transform;
