/* MODULES */
import {GoogleApis, youtube_v3} from "googleapis";

/* UTILITIES */
import {AsyncUtil} from "./asyncUtil";
import {LoadUrl} from "./urlLoader";
import {jsonUtils} from "./jsonUtils";
import {Properties} from "./fetchProperties";
import {dBug} from "./dBug";
import {Config} from "./fetchConfig";
import {getPlaylistCounts} from "./processPlaylists";

export const fetchChannelPlaylists = async (channelId: string) => {
    const debg = new dBug("utilities:fetchChannelPlaylists");
    
    const props = new Properties({
        "youtubeApiKey": ""
    });

    debg.call("Fetching Properties");
    let properties = await props.fetch() as {youtubeApiKey: string;};
    debg.call(properties.youtubeApiKey);
    
    const google = new GoogleApis({
        auth: properties.youtubeApiKey
    });
    
    const service = google.youtube("v3");
    
    const capWord = async (word) => {
        const capLetter = word.slice(0, 1);
        const restWord = word.slice(1);
        const slashWord = word.split("/");
    
        if (slashWord.length > 1) {
            const newWords = [];
            for await (const newWord of slashWord) {
                const thisWord = await capWord(newWord);
                newWords.push(thisWord);
            }
    
            return newWords.join(" / ");
        }
        return await `${capLetter.toUpperCase()}${restWord}`
    }
    
    const toTitleCase = async(fullTitle) => {
        const titleWords = fullTitle.split(" ");
        const workingTitle = [];
    
        for await (const word of titleWords) {
            workingTitle.push(await capWord(word));
        }
    
        return workingTitle.join(" ");
    }
    
    const fetchPlaylistData = async (channelId: string) => {
        try {
            const allLists = await service.playlists.list({
                part: ["id", "snippet", "status"],
                maxResults: 200,
                channelId
            });
            console.log("Playlists fetched");
    
            return allLists.data.items;
        } catch (error) {
            console.error(`Unable to fetch Playlists ${error}`);
        }
    };
    
    const processPlaylists = async (allPlaylists) => {
        const processedLinks = {};
    
        for await (const playlist of allPlaylists) {
            const playlistName = playlist.snippet.title;
            const link = `https://www.youtube.com/playlist?list=${playlist.id}`;
            const id = playlist.id;
    
            if (playlistName.toLowerCase().indexOf("d&d") >= 0 && playlistName.toLowerCase().indexOf("d&d timeline") < 0) {
                try {
                    const playlistTitle = await toTitleCase(playlistName.toLowerCase().split("d&d")[1].trim());
                    processedLinks[playlistTitle === "Intro" ? "!!! Intro !!!" : playlistTitle] = {
                        link,
                        id
                    };
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
                } catch (err) {
                    throw (err);
                }
            }
        }
    
        return processedLinks;
    };
    
    const initialize = async () => {
        const deb = debg.set("initialize");
        try {
            const jsonCache = new jsonUtils("./json/listCount.json");
            await jsonCache.checkPath();
            const lastUpdate = await jsonCache.get("lastUpdate") as number;

            if (!!lastUpdate && Date.now() < (lastUpdate + (12 * 60 * 60 * 1000))) {
                deb("JSON Cache Recently Updated");    
            }

            const listItems = await fetchPlaylistData(channelId);
            const processed = await processPlaylists(listItems);
            const countedList = await getPlaylistCounts(processed, jsonCache);
            deb("Completed Fetch");
        } catch (error) {
            deb(`Unable to fetch ${error}`);
        }
    }

    await initialize()
        .catch((err) => {
            console.error(err);
        });
}

const test = async () => {
    await fetchChannelPlaylists("UCr7k176h5b1JwD9yXpSUkGA");
}

test()
    .catch((err) => {
        console.log(err);
    });