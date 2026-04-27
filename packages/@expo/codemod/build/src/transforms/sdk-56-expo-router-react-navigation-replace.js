"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isImportKindAware = (node) => node !== null && node !== undefined;
const IMPORT_MAP = {
    '@react-navigation/native': 'expo-router',
    '@react-navigation/stack': 'expo-router/js-stack',
    '@react-navigation/bottom-tabs': 'expo-router/js-tabs',
    '@react-navigation/material-top-tabs': 'expo-router/js-top-tabs',
};
const UNSUPPORTED_SPECIFIERS = {
    ImportDefaultSpecifier: 'default import',
    ImportNamespaceSpecifier: 'namespace import (import * as ...)',
};
const sourceOf = (path) => String(path.node.source.value);
const lineOf = (path) => path.node.loc ? path.node.loc.start.line : 'unknown';
const isMappable = (path) => IMPORT_MAP[sourceOf(path)] !== undefined;
const isTypeSpecifier = (spec) => isImportKindAware(spec) && spec.importKind === 'type';
const isTypeOnlyImport = (path) => isImportKindAware(path.node) && path.node.importKind === 'type';
// Recast caches each node's source text and reprints from that cache when the
// node reference looks unchanged. When we swap in specifiers that differ only
// in metadata (e.g. a specifier that had a displaced `type` modifier), the
// cached source would still carry the old modifier. Clearing `original` forces
// recast to print fresh from the AST.
const forceReprint = (node) => {
    node.original = null;
};
// Clone a specifier with an inline `type` modifier: `import { type A }`. Inline
// `type` marks a single specifier as type-only while letting the rest of the
// declaration carry value specifiers — needed when we merge an `import type`
// declaration into a value declaration that also brings in values. Clones
// instead of mutating so the original specifier (on a declaration that will be
// removed) isn't altered mid-transform.
const markAsInlineType = (spec) => {
    const clone = { ...spec };
    if (isImportKindAware(clone))
        clone.importKind = 'type';
    return clone;
};
const collectUnsupportedErrors = (filePath, paths) => {
    const errors = [];
    for (const path of paths) {
        const specifiers = (path.node.specifiers ?? []);
        for (const spec of specifiers) {
            const label = UNSUPPORTED_SPECIFIERS[spec.type];
            if (!label)
                continue;
            errors.push(`${filePath}:${lineOf(path)} - ${label} from "${sourceOf(path)}" is not supported. ` +
                `Replace with named imports before running this codemod.`);
        }
    }
    return errors;
};
// Deduplicate specifiers by local binding name; value wins over type.
// `valueDisplacedType` lets the caller invalidate recast's cached source.
const dedupeByLocalName = (specifiers) => {
    // `local?.name` is typed as `string | IdentifierKind | undefined` — Map with
    // an `unknown` key preserves the identity/equality semantics the original
    // `find` used (strings compared by value, objects by reference).
    const byName = new Map();
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
const groupPathsBySource = (paths) => {
    const groups = new Map();
    for (const path of paths) {
        const source = sourceOf(path);
        const existing = groups.get(source);
        if (existing) {
            existing.push(path);
        }
        else {
            groups.set(source, [path]);
        }
    }
    return groups;
};
// Flatten every specifier across the group's declarations into one list.
// When the group mixes `import type` with value imports, specifiers that came
// from a type-only declaration get an inline `type` modifier so their type-only
// nature survives the merge into the single (value) keeper.
const collectSpecifiers = (groupPaths, mixesTypeAndValueImports) => {
    const out = [];
    for (const path of groupPaths) {
        const specs = (path.node.specifiers ?? []);
        if (mixesTypeAndValueImports && isTypeOnlyImport(path)) {
            for (const spec of specs)
                out.push(markAsInlineType(spec));
        }
        else {
            for (const spec of specs)
                out.push(spec);
        }
    }
    return out;
};
const mergeGroup = (j, groupPaths) => {
    const hasAnyTypeOnlyImport = groupPaths.some(isTypeOnlyImport);
    const allImportsAreTypeOnly = groupPaths.every(isTypeOnlyImport);
    // Mixed: `import type { A }` + `import { B }` → `import { type A, B }`.
    const mixesTypeAndValueImports = hasAnyTypeOnlyImport && !allImportsAreTypeOnly;
    const [keeper, ...rest] = groupPaths;
    if (!keeper)
        return;
    const { specifiers, valueDisplacedType } = dedupeByLocalName(collectSpecifiers(groupPaths, mixesTypeAndValueImports));
    keeper.node.specifiers = specifiers;
    if (mixesTypeAndValueImports && isImportKindAware(keeper.node)) {
        keeper.node.importKind = 'value';
    }
    if (valueDisplacedType)
        forceReprint(keeper.node);
    for (const path of rest)
        j(path).remove();
};
const transform = (fileInfo, api) => {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
    const mappablePaths = root
        .find(j.ImportDeclaration)
        .filter((path) => isMappable(path))
        .paths();
    if (mappablePaths.length === 0)
        return undefined;
    const errors = collectUnsupportedErrors(fileInfo.path, mappablePaths);
    if (errors.length > 0) {
        throw new Error(`Unsupported import style(s) found:\n${errors.join('\n')}`);
    }
    for (const path of mappablePaths) {
        path.node.source.value = IMPORT_MAP[sourceOf(path)];
    }
    const groups = groupPathsBySource(root.find(j.ImportDeclaration).paths());
    for (const groupPaths of groups.values()) {
        if (groupPaths.length > 1)
            mergeGroup(j, groupPaths);
    }
    return root.toSource();
};
exports.default = transform;
//# sourceMappingURL=sdk-56-expo-router-react-navigation-replace.js.map