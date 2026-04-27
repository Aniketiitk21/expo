"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommand = void 0;
exports.parseAndValidateArgs = parseAndValidateArgs;
exports.resolveAndDispatch = resolveAndDispatch;
const chalk_1 = __importDefault(require("chalk"));
const globby_1 = __importDefault(require("globby"));
const multimatch_1 = __importDefault(require("multimatch"));
const Log = __importStar(require("../log"));
const transforms_1 = require("../transforms");
const args_1 = require("../utils/args");
const runner_1 = require("../utils/runner");
const OPTIONS_BLOCK = [
    '<transform>                   (required) name of transform to apply to files',
    '                              (see a list of transforms available below)',
    '<paths...>                    one or more paths or globs (e.g. src/**/*.tsx)',
    '                              files in .gitignore are ignored by default',
    '-h, --help                    print this help message',
    '-v, --version                 print the CLI version',
].join('\n');
const transformsBlock = (transforms) => ['', `  ${chalk_1.default.bold('Transforms available')}`, ...transforms.map((t) => `    ${t}`), ''].join('\n');
/**
 * Parse argv, validate it against the available transforms, and return the
 * resolved command. Prints help and exits when --help is passed or required
 * arguments are missing.
 */
async function parseAndValidateArgs(argv) {
    const args = (0, args_1.assertWithOptionsArgs)({
        '--help': Boolean,
        '-h': '--help',
    }, { argv, permissive: true });
    const transforms = await (0, transforms_1.listTransformsAsync)();
    const [transform, ...paths] = args._;
    if (args['--help'] || !transform || paths.length === 0) {
        (0, args_1.printHelp)('Run a codemod transform against the given paths.', 'npx @expo/codemod <transform> <paths...>', OPTIONS_BLOCK, transformsBlock(transforms));
    }
    if (!transforms.includes(transform)) {
        Log.exit(`Transform "${transform}" does not exist. Valid options: ${transforms.join(', ')}`);
    }
    return { transform, paths };
}
/**
 * Expand the given paths into a file list (respecting .gitignore) and dispatch
 * them to the jscodeshift runner. Files are split by extension into the `tsx`
 * and `jsx` parser buckets.
 */
async function resolveAndDispatch(command) {
    const { transform, paths } = command;
    const allFiles = await (0, globby_1.default)(paths, {
        gitignore: true,
        ignore: ['**/node_modules/**'],
    });
    const tsxFiles = (0, multimatch_1.default)(allFiles, ['**/*.ts', '**/*.tsx']);
    const jsxFiles = (0, multimatch_1.default)(allFiles, ['**/*.js', '**/*.jsx']);
    if (tsxFiles.length) {
        Log.log(`Transforming ${tsxFiles.length} TSX files...`);
        await (0, runner_1.runTransformAsync)({ files: tsxFiles, parser: 'tsx', transform });
    }
    if (jsxFiles.length) {
        Log.log(`Transforming ${jsxFiles.length} JSX files...`);
        await (0, runner_1.runTransformAsync)({ files: jsxFiles, parser: 'jsx', transform });
    }
}
const runCommand = async (argv) => {
    const command = await parseAndValidateArgs(argv);
    await resolveAndDispatch(command);
};
exports.runCommand = runCommand;
//# sourceMappingURL=index.js.map