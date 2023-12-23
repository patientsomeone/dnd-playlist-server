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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = exports.decrypt = void 0;
/* Import MODULES */
const atob = __importStar(require("atob"));
const btoa = __importStar(require("btoa"));
const dBug_1 = require("../utilities/dBug");
const debCrypt = new dBug_1.dBug("agents:oosConnect");
const decrypt = (value) => {
    // const debDecrypt = debCrypt.set("decrypt");
    // debDecrypt(`Decrypting value ${value}`);
    return atob(atob(value));
};
exports.decrypt = decrypt;
const encrypt = (value) => {
    // const debEncrypt = debCrypt.set("encrypt");
    // debEncrypt(`Encrypting value ${value}`);
    return btoa(btoa(value));
};
exports.encrypt = encrypt;
//# sourceMappingURL=decode.js.map