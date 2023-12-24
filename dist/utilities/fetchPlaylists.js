"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchChannelPlaylists = void 0;
/* MODULES */
const googleapis_1 = require("googleapis");
const jsonUtils_1 = require("./jsonUtils");
const fetchProperties_1 = require("./fetchProperties");
const dBug_1 = require("./dBug");
const processPlaylists_1 = require("./processPlaylists");
const fetchChannelPlaylists = (channelId) => __awaiter(void 0, void 0, void 0, function* () {
    const debg = new dBug_1.dBug("utilities:fetchChannelPlaylists");
    const props = new fetchProperties_1.Properties({
        "youtubeApiKey": ""
    });
    debg.call("Fetching Properties");
    let properties = yield props.fetch();
    debg.call(properties.youtubeApiKey);
    const google = new googleapis_1.GoogleApis({
        auth: properties.youtubeApiKey
    });
    const service = google.youtube("v3");
    const capWord = (word) => __awaiter(void 0, void 0, void 0, function* () {
        var e_1, _a;
        const capLetter = word.slice(0, 1);
        const restWord = word.slice(1);
        const slashWord = word.split("/");
        if (slashWord.length > 1) {
            const newWords = [];
            try {
                for (var slashWord_1 = __asyncValues(slashWord), slashWord_1_1; slashWord_1_1 = yield slashWord_1.next(), !slashWord_1_1.done;) {
                    const newWord = slashWord_1_1.value;
                    const thisWord = yield capWord(newWord);
                    newWords.push(thisWord);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (slashWord_1_1 && !slashWord_1_1.done && (_a = slashWord_1.return)) yield _a.call(slashWord_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return newWords.join(" / ");
        }
        return yield `${capLetter.toUpperCase()}${restWord}`;
    });
    const toTitleCase = (fullTitle) => __awaiter(void 0, void 0, void 0, function* () {
        var e_2, _b;
        const titleWords = fullTitle.split(" ");
        const workingTitle = [];
        try {
            for (var titleWords_1 = __asyncValues(titleWords), titleWords_1_1; titleWords_1_1 = yield titleWords_1.next(), !titleWords_1_1.done;) {
                const word = titleWords_1_1.value;
                workingTitle.push(yield capWord(word));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (titleWords_1_1 && !titleWords_1_1.done && (_b = titleWords_1.return)) yield _b.call(titleWords_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return workingTitle.join(" ");
    });
    const fetchPlaylistData = (channelId) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const allLists = yield service.playlists.list({
                part: ["id", "snippet", "status"],
                maxResults: 200,
                channelId
            });
            console.log("Playlists fetched");
            return allLists.data.items;
        }
        catch (error) {
            console.error(`Unable to fetch Playlists ${error}`);
        }
    });
    const processPlaylists = (allPlaylists) => { var allPlaylists_1, allPlaylists_1_1; return __awaiter(void 0, void 0, void 0, function* () {
        var e_3, _a;
        const processedLinks = {};
        try {
            for (allPlaylists_1 = __asyncValues(allPlaylists); allPlaylists_1_1 = yield allPlaylists_1.next(), !allPlaylists_1_1.done;) {
                const playlist = allPlaylists_1_1.value;
                const playlistName = playlist.snippet.title;
                const link = `https://www.youtube.com/playlist?list=${playlist.id}`;
                const id = playlist.id;
                if (playlistName.toLowerCase().indexOf("d&d") >= 0 && playlistName.toLowerCase().indexOf("d&d timeline") < 0) {
                    try {
                        const playlistTitle = yield toTitleCase(playlistName.toLowerCase().split("d&d")[1].trim());
                        processedLinks[playlistTitle === "Intro" ? "!!! Intro !!!" : playlistTitle] = {
                            link,
                            id
                        };
                    }
                    catch (err) {
                        throw (err);
                    }
                }
                else if (playlistName.toLowerCase().indexOf("emotional") >= 0 || playlistName.toLowerCase().indexOf("normal explore") >= 0) {
                    try {
                        const playlistTitle = yield toTitleCase(playlistName.toLowerCase().trim());
                        processedLinks[playlistTitle] = {
                            link,
                            id
                        };
                    }
                    catch (err) {
                        throw (err);
                    }
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (allPlaylists_1_1 && !allPlaylists_1_1.done && (_a = allPlaylists_1.return)) yield _a.call(allPlaylists_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return processedLinks;
    }); };
    const initialize = () => __awaiter(void 0, void 0, void 0, function* () {
        const deb = debg.set("initialize");
        try {
            const jsonCache = new jsonUtils_1.jsonUtils("./json/listCount.json");
            yield jsonCache.checkPath();
            const lastUpdate = yield jsonCache.get("lastUpdate");
            if (!!lastUpdate && Date.now() < (lastUpdate + (12 * 60 * 60 * 1000))) {
                deb("JSON Cache Recently Updated");
            }
            const listItems = yield fetchPlaylistData(channelId);
            const processed = yield processPlaylists(listItems);
            const countedList = yield (0, processPlaylists_1.getPlaylistCounts)(processed, jsonCache);
            deb("Completed Fetch");
        }
        catch (error) {
            deb(`Unable to fetch ${error}`);
        }
    });
    yield initialize()
        .catch((err) => {
        console.error(err);
    });
});
exports.fetchChannelPlaylists = fetchChannelPlaylists;
const test = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, exports.fetchChannelPlaylists)("UCr7k176h5b1JwD9yXpSUkGA");
});
test()
    .catch((err) => {
    console.log(err);
});
//# sourceMappingURL=fetchPlaylists.js.map