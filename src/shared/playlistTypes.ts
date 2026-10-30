export type individualPlaylist = {
    id: string;
    link: string;
    count: number;
};

export type playlistResponseData = Record<string, {id: string; link: string;}>;
export type playlistProcessed = Record<string, individualPlaylist>;
export type listData = {listEndpoint?: string;};
