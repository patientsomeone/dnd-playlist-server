import {anyObject, stringObject} from "../.types";
import {log, err} from "../utilities/log";
import {playlistData, processedLinks} from "../utilities/processPlaylists";
import {toTitleCase} from "../utilities/textManipulators";

export const dipsProcessor = async (playlist: playlistData): Promise<processedLinks> => {
    const playlistName = playlist.snippet.title;
    const link = `https://www.youtube.com/playlist?list=${playlist.id}`;
    const id = playlist.id;

    log(`Processing Playlist ${playlist.snippet.title}`);
    // log(`Processing Playlist ${id}`);
    
    if (playlistName.toLowerCase().indexOf("d&d") >= 0 && playlistName.toLowerCase().indexOf("d&d timeline") < 0) {
        try {
            const playlistTitle = await toTitleCase(playlistName.toLowerCase().split("d&d")[1].trim());
            return {
                name: playlistTitle === "Intro" ? "!!! Intro !!!" : playlistTitle,
                data: {
                    link,
                    id
                }
            };
        } catch (error) {
            err(error);
            throw (error);
        }
    } else if (playlistName.toLowerCase().indexOf("emotional") >= 0 || playlistName.toLowerCase().indexOf("normal explore") >= 0) {
        try {
            const playlistTitle = await toTitleCase(playlistName.toLowerCase().trim());
            return {
                name: playlistTitle,
                data: {
                    link,
                    id
                }
            };
        } catch (error) {
            err(error);
            throw (error);
        }
    }
};