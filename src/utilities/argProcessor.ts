/* -- UTILITIES -- */
import { AsyncUtil } from "./asyncUtil";
import {anyStandard} from "../.types";

interface IargumentMap {
    [argument: string]: () => anyStandard;
}

export const executeArguments = async (argumentMap: IargumentMap, passedArguments?: string[]): Promise<void> => {
    const currentArguments = (passedArguments || process.argv);

    await AsyncUtil.eachOfSeries(currentArguments, (argument, triggerNext, callback, counterLog) => {
        if (typeof argument === "string") {
            if (argumentMap.hasOwnProperty(argument)) {
                counterLog(argument);
                argumentMap[argument]();
            }
        }
        callback();
    });
};
