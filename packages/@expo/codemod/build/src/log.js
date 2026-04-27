"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.error = error;
exports.exit = exit;
const chalk_1 = __importDefault(require("chalk"));
function log(...message) {
    console.log(...message);
}
function error(...message) {
    console.error(...message.map((value) => chalk_1.default.red(value)));
}
function exit(message, code = 1) {
    if (message) {
        const text = message instanceof Error ? message.message : message;
        if (code === 0) {
            log(text);
        }
        else {
            error(text);
        }
    }
    process.exit(code);
}
//# sourceMappingURL=log.js.map