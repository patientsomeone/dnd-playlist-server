import React from "react";
import { Request } from "express";
import {fetchChannelPlaylists} from "../utilities/fetchPlaylists";
import {log} from "../utilities/log";
import {playlistQueries} from "../.types";
import {elapsed} from "../utilities/timeConversion";

export const dipsLists = async (request: Request): Promise<JSX.Element> => {
    const startTime = Date.now();
    const listData = await fetchChannelPlaylists({
        channelId: "UCr7k176h5b1JwD9yXpSUkGA"
    }) as playlistQueries;

    log(`First list ID: ${listData[Object.keys(listData)[0]].id as string}`);
    log(listData);

    log(`Time to data: ${elapsed(startTime, Date.now())}`);
    return Promise.resolve(
        <body>
            <div>
                <h1> Hello World from the land of Dip's Lists! </h1>
                <span>
                    You arrived here from {request.path};
                </span>
            </div>
        </body>
    );
};