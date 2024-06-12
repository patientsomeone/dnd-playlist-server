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
const fsUtils_1 = require("./fsUtils");
const dateStamp_1 = require("./dateStamp");
const fetchChannelPlaylists = (channelId) => __awaiter(void 0, void 0, void 0, function* () {
    const debg = new dBug_1.dBug("utilities:fetchChannelPlaylists");
    const logFile = new fsUtils_1.FsUtils(`./logs/${(0, dateStamp_1.dateStamp)()}_playlistLogs.txt`);
    const logger = logFile.logFile;
    const apiLock = new fsUtils_1.FsUtils("./playlists.lock");
    const isLocked = yield apiLock.check()
        .catch((err) => {
        return Promise.resolve(false);
    });
    const props = new fetchProperties_1.Properties({
        "youtubeApiKey": ""
    });
    debg.call("Fetching Properties");
    const properties = yield props.fetch();
    debg.call(properties.youtubeApiKey);
    const google = new googleapis_1.GoogleApis({
        auth: properties.youtubeApiKey
    });
    const service = google.youtube("v3");
    const capWord = (word) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        const capLetter = word.slice(0, 1);
        const restWord = word.slice(1);
        const slashWord = word.split("/");
        if (slashWord.length > 1) {
            const newWords = [];
            try {
                for (var _d = true, slashWord_1 = __asyncValues(slashWord), slashWord_1_1; slashWord_1_1 = yield slashWord_1.next(), _a = slashWord_1_1.done, !_a;) {
                    _c = slashWord_1_1.value;
                    _d = false;
                    try {
                        const newWord = _c;
                        const thisWord = yield capWord(newWord);
                        newWords.push(thisWord);
                    }
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = slashWord_1.return)) yield _b.call(slashWord_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return newWords.join(" / ");
        }
        return `${capLetter.toUpperCase()}${restWord}`;
    });
    const toTitleCase = (fullTitle) => __awaiter(void 0, void 0, void 0, function* () {
        var _e, e_2, _f, _g;
        const titleWords = fullTitle.split(" ");
        const workingTitle = [];
        try {
            for (var _h = true, titleWords_1 = __asyncValues(titleWords), titleWords_1_1; titleWords_1_1 = yield titleWords_1.next(), _e = titleWords_1_1.done, !_e;) {
                _g = titleWords_1_1.value;
                _h = false;
                try {
                    const word = _g;
                    workingTitle.push(yield capWord(word));
                }
                finally {
                    _h = true;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (!_h && !_e && (_f = titleWords_1.return)) yield _f.call(titleWords_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return workingTitle.join(" ");
    });
    const fetchPlaylistData = (channelId, pageToken) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            let workingLists = [];
            const listConfig = {
                part: ["id", "snippet", "status"],
                maxResults: 50,
                channelId
            };
            if (!!pageToken)
                (listConfig.pageToken = pageToken);
            const allLists = yield service.playlists.list(listConfig);
            /* console.log("Playlists fetched"); */
            if (allLists.data.hasOwnProperty("nextPageToken")) {
                workingLists = workingLists.concat(yield fetchPlaylistData(channelId, allLists.data.nextPageToken));
            }
            workingLists = workingLists.concat(allLists.data.items);
            return workingLists;
        }
        catch (error) {
            console.error(`Unable to fetch Playlists ${error}`);
        }
    });
    const processPlaylists = (allPlaylists) => { var _a, allPlaylists_1, allPlaylists_1_1; return __awaiter(void 0, void 0, void 0, function* () {
        var _b, e_3, _c, _d;
        const processedLinks = {};
        let checkedLists = 0;
        let foundLists = 0;
        try {
            for (_a = true, allPlaylists_1 = __asyncValues(allPlaylists); allPlaylists_1_1 = yield allPlaylists_1.next(), _b = allPlaylists_1_1.done, !_b;) {
                _d = allPlaylists_1_1.value;
                _a = false;
                try {
                    const playlist = _d;
                    const playlistName = playlist.snippet.title;
                    const link = `https://www.youtube.com/playlist?list=${playlist.id}`;
                    const id = playlist.id;
                    checkedLists += 1;
                    if (playlistName.toLowerCase().indexOf("d&d") >= 0 && playlistName.toLowerCase().indexOf("d&d timeline") < 0) {
                        try {
                            const playlistTitle = yield toTitleCase(playlistName.toLowerCase().split("d&d")[1].trim());
                            processedLinks[playlistTitle === "Intro" ? "!!! Intro !!!" : playlistTitle] = {
                                link,
                                id
                            };
                            foundLists += 1;
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
                            foundLists += 1;
                        }
                        catch (err) {
                            throw (err);
                        }
                    }
                }
                finally {
                    _a = true;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (!_a && !_b && (_c = allPlaylists_1.return)) yield _c.call(allPlaylists_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        yield logger(`Checked ${checkedLists} playlists`);
        yield logger(`Found ${foundLists} playlists`);
        return processedLinks;
    }); };
    const initialize = () => __awaiter(void 0, void 0, void 0, function* () {
        const deb = debg.set("initialize");
        yield logger("Checking playlist files...");
        try {
            const jsonCache = new jsonUtils_1.jsonUtils("./json/listCount.json");
            yield jsonCache.checkPath();
            const lastUpdate = jsonCache.get("lastUpdate") || false;
            if (!!lastUpdate && Date.now() < (lastUpdate + (12 * 60 * 60 * 1000))) {
                yield logger("API Data up to date");
                deb("JSON Cache Recently Updated");
                return jsonCache.read();
            }
            if (!isLocked) {
                yield logger("Locking API execution");
                yield apiLock.create.raw("");
            }
            const listItems = yield fetchPlaylistData(channelId);
            const processed = yield processPlaylists(listItems);
            const countedList = yield (0, processPlaylists_1.getPlaylistCounts)(processed, jsonCache);
            yield logger("Fetched Playlist count data");
            yield apiLock.delete();
            yield logger("Deleted Playlist lock");
            yield logger("Playlist Update Complete");
            return countedList;
        }
        catch (error) {
            deb(`Unable to fetch ${error}`);
        }
    });
    if (!!isLocked) {
        yield logger("On Load Status Check: API Processing");
        return { status: "processing" };
    }
    try {
        return yield initialize();
    }
    catch (err) {
        yield logger(`Unable to fetch Playlists ${err}`, true);
    }
});
exports.fetchChannelPlaylists = fetchChannelPlaylists;
const test = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, exports.fetchChannelPlaylists)("UCr7k176h5b1JwD9yXpSUkGA");
});
// test()
//     .catch((err) => {
//         console.error(err);
//     });
//# sourceMappingURL=fetchPlaylists.js.map