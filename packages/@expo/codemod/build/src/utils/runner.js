"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTransformAsync = runTransformAsync;
const Runner_1 = __importDefault(require("jscodeshift/src/Runner"));
const transforms_1 = require("../transforms");
const JSCODESHIFT_PARSER = {
    tsx: 'tsx',
    jsx: 'babel',
};
async function runTransformAsync({ files, parser, transform, }) {
    await Runner_1.default.run((0, transforms_1.transformFilePath)(transform), files, {
        babel: false,
        parser: JSCODESHIFT_PARSER[parser],
        verbose: 0,
    });
}
//# sourceMappingURL=runner.js.map