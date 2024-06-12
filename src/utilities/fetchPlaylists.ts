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
import {logLine} from "./log";
import {FsUtils} from "./fsUtils";
import {dateStamp} from "./dateStamp";

export const fetchChannelPlaylists = async (channelId: string) => {
    const debg = new dBug("utilities:fetchChannelPlaylists");
    const logFile = new FsUtils(`./logs/${dateStamp()}_playlistLogs.txt`);
    const logger = logFile.logFile;

    const apiLock = new FsUtils("./playlists.lock");
    const isLocked = await apiLock.check()
        .catch((err) => {
            return Promise.resolve(false);
        });
    
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
    };

    const fetchPlaylistData = async (channelId: string, pageToken?: string) => {
        try {
            let workingLists = [];

            const listConfig = {
                part: ["id", "snippet", "status"],
                maxResults: 50,
                channelId
            } as {
                part: string[];
                maxResults: number;
                channelId: string;
                pageToken?: string
            };

            if (!!pageToken) (
                listConfig.pageToken = pageToken
            );

            const allLists = await service.playlists.list(listConfig);
            console.log("Playlists fetched");

            if (allLists.data.hasOwnProperty("nextPageToken")) {
                workingLists = workingLists.concat(await fetchPlaylistData(channelId, allLists.data.nextPageToken));
            };
    
            workingLists = workingLists.concat(allLists.data.items);

            return workingLists;
        } catch (error) {
            console.error(`Unable to fetch Playlists ${error}`);
        }
    };
    
    const processPlaylists = async (allPlaylists) => {
        const processedLinks = {};
        let checkedLists = 0;
        let foundLists = 0;
    
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

        logger(`Checked ${checkedLists} playlists`);
        logger(`Found ${foundLists} playlists`);
    
        return processedLinks;
    };
    
    const initialize = async () => {
        const deb = debg.set("initialize");
        await logger("Checking playlist files...")
        try {
            const jsonCache = new jsonUtils("./json/listCount.json");
            await jsonCache.checkPath();
            const lastUpdate = await jsonCache.get("lastUpdate") as number || false;
            
            if (!!lastUpdate && Date.now() < (lastUpdate + (12 * 60 * 60 * 1000))) {
                await logger("API Data up to date");
                deb("JSON Cache Recently Updated");
                return jsonCache.read();
            }

            if (!isLocked) {
                await logger("Locking API execution");
                await apiLock.create.raw("");
            }

            const listItems = await fetchPlaylistData(channelId);
            const processed = await processPlaylists(listItems);
            const countedList = await getPlaylistCounts(processed, jsonCache);

            await logger("Fetched Playlist count data");

            await apiLock.delete();
            await logger("Deleted Playlist lock");

            await logger("Playlist Update Complete");

            return countedList;
        } catch (error) {
            deb(`Unable to fetch ${error}`);
        }
    }

    if (!!isLocked) {
        await logger("On Load Status Check: API Processing");
        return {status: "processing"};
    }

    try {
        return await initialize()
    } catch (err) {
        logger(`Unable to fetch Playlists ${err}`, true);
    }
}

const test = async () => {
    await fetchChannelPlaylists("UCr7k176h5b1JwD9yXpSUkGA");
}

// test()
//     .catch((err) => {
//         console.error(err);
//     });