/* eslint-disable camelcase */
/* MODULES */
import {GoogleApis, youtube_v3} from "googleapis";

/* UTILITIES */
import {AsyncUtil} from "./asyncUtil";
import {LoadUrl} from "./urlLoader";
import {jsonUtils} from "./jsonUtils";
import {dBug} from "./dBug";
import {Config} from "./fetchConfig";
import {anyObject, playlistResponseData} from "../.types";
import {FsUtils} from "./fsUtils";
import {dateStamp} from "./dateStamp";
import {fetchEnv} from "./fetchEnv";
import {log} from "./log";
import {toTitleCase} from "./textManipulators";


export const processPlaylists = async (allPlaylists: {snippet: {title: string;}; id: string;}[]) => {
    const processedLinks = {};
    let checkedLists = 0;
    let foundLists = 0;

    // TODO: Migrate hard coded logic into passthrough methodology

    for await (const playlist of allPlaylists) {
        const playlistName = playlist.snippet.title;
        const link = `https://www.youtube.com/playlist?list=${playlist.id}`;
        const id = playlist.id;

        checkedLists += 1;

        if (playlistName.toLowerCase().indexOf("d&d") >= 0 && playlistName.toLowerCase().indexOf("d&d timeline") < 0) {
            try {
                const playlistTitle = await toTitleCase(playlistName.toLowerCase().split("d&d")[1].trim());
                processedLinks[playlistTitle === "Intro" ? "!!! Intro !!!" : playlistTitle] = {
                    link,
                    id
                };
                foundLists += 1;
            } catch (err) {
                throw (err);
            }
        } else if (playlistName.toLowerCase().indexOf("emotional") >= 0 || playlistName.toLowerCase().indexOf("normal explore") >= 0) {
            try {
                const playlistTitle = await toTitleCase(playlistName.toLowerCase().trim());
                processedLinks[playlistTitle] = {
                    link,
                    id
                };
                foundLists += 1;
            } catch (err) {
                throw (err);
            }
        }
    }

    log(`Checked ${checkedLists} playlists`);
    log(`Identified ${foundLists} playlists`);

    return processedLinks;
};