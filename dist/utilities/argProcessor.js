"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeArguments = void 0;
const asyncUtil_1 = require("./asyncUtil");
const executeArguments = (argumentMap, passedArguments) => {
    const currentArguments = (passedArguments || process.argv);
    asyncUtil_1.AsyncUtil.eachOfSeries(currentArguments, (argument, triggerNext, callback, counterLog) => {
        if (typeof argument === "string") {
            if (argumentMap.hasOwnProperty(argument)) {
                counterLog(argument);
                argumentMap[argument]();
            }
        }
        callback();
    });
};
exports.executeArguments = executeArguments;
//# sourceMappingURL=argProcessor.js.map