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
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeArguments = void 0;
/* -- UTILITIES -- */
const asyncUtil_1 = require("./asyncUtil");
const executeArguments = (argumentMap, passedArguments) => __awaiter(void 0, void 0, void 0, function* () {
    const currentArguments = (passedArguments || process.argv);
    yield asyncUtil_1.AsyncUtil.eachOfSeries(currentArguments, (argument, triggerNext, callback, counterLog) => {
        if (typeof argument === "string") {
            if (argumentMap.hasOwnProperty(argument)) {
                counterLog(argument);
                argumentMap[argument]();
            }
        }
        callback();
    });
});
exports.executeArguments = executeArguments;
//# sourceMappingURL=argProcessor.js.map