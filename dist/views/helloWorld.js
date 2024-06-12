"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelloWorld = void 0;
const react_1 = __importDefault(require("react"));
const HelloWorld = (request) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Attempting to write to TSX");
    return (react_1.default.createElement("div", null,
        react_1.default.createElement("h1", null, " Hello World from the land of DND! "),
        react_1.default.createElement("span", null,
            "You arrived here from ",
            request.path,
            ";")));
});
exports.HelloWorld = HelloWorld;
//# sourceMappingURL=helloWorld.js.map