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
}

export type anyArray = anyStandard[];

export type playlistResponseData = {
    [key: string]: {
        id: string;
        link: string;
    }
};

export type individualPlaylist = {
    id: string;
    link: string;
    count: number;
}

export type playlistProcessed = {
    [key: string]: individualPlaylist;
};

export type playlistQueries = {
    channelId: string; 
    singlePlaylist?: boolean;
    test?: string;
};

export type listData = {
    listEndpoint?: string;
};