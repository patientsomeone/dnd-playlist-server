/* Sanitized Any */
export type anyStandard = (string | number | boolean | anyObject | void | anyArray | anyFunction);

/* Sanitized Function */
export type anyFunction = (arg?: anyStandard) => anyStandard;

/* Sanitized Object */
export type anyObject = {
    [key: string | number]: anyStandard;
};

export type stringObject = {
    [key: string]: string;
};

export type anyArray = anyStandard[];

export type {individualPlaylist, playlistProcessed, playlistResponseData, listData} from "./shared/playlistTypes";

export type playlistQueries = {
    channelId: string;
    singlePlaylist?: boolean;
    test?: string;
};
