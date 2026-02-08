import {playlistQueries, stringObject} from "../.types";
import {fetchEnv} from "./fetchEnv";
import {log} from "./log";

export const queryProcessor = async (queryObject: stringObject): Promise<playlistQueries> => {
    const defaultQuery = {
        channelId: async () => {
            return await fetchEnv("YT_LIST_OWNER");
        },
        singlePlaylist: async () => {
            return Promise.resolve(false);
        }
    };
    
    const workingQuery = {} as playlistQueries;
    
    for await (const key of Object.keys(defaultQuery)) {
        if (queryObject.hasOwnProperty(key)) {
            // Convert Boolean
            if (queryObject[key].toLocaleLowerCase() === "true") {
                workingQuery[key] = true;
            } else if (queryObject[key].toLocaleLowerCase() === "false") {
                    workingQuery[key] = false;
            } else {
                workingQuery[key] = queryObject[key];
            }
        } else {
            workingQuery[key] = await defaultQuery[key]();
        }
    }

    log(workingQuery);
    
    return workingQuery;
};