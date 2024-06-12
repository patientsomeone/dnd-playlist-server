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
exports.getPlaylistCounts = void 0;
/* eslint-disable camelcase */
/* MODULES */
const googleapis_1 = require("googleapis");
const jsonUtils_1 = require("./jsonUtils");
const fetchProperties_1 = require("./fetchProperties");
const dBug_1 = require("./dBug");
const fetchConfig_1 = require("./fetchConfig");
const fsUtils_1 = require("./fsUtils");
const dateStamp_1 = require("./dateStamp");
const getPlaylistCounts = (playlistData, jsonCache) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    const debg = new dBug_1.dBug("utilities:getPlaylistCounts");
    const logFile = new fsUtils_1.FsUtils(`./logs/${(0, dateStamp_1.dateStamp)()}_playlistLogs.txt`);
    const logger = logFile.logFile;
    const props = new fetchProperties_1.Properties({
        "youtubeApiKey": ""
    });
    debg.call("Fetching Properties");
    const properties = yield props.fetch();
    debg.call(properties.youtubeApiKey);
    const config = new fetchConfig_1.Config({ "playlists": {} });
    debg.call("Fetching Module Config");
    // const listData = (await config.fetch() as {playlists: {[key: string]: string}}).playlists;
    // debg.call(listData);
    const countData = {};
    const google = new googleapis_1.GoogleApis({
        auth: properties.youtubeApiKey
    });
    const service = google.youtube("v3");
    const countVideos = (videos) => { var _a, videos_1, videos_1_1; return __awaiter(void 0, void 0, void 0, function* () {
        var _b, e_2, _c, _d;
        let count = 0;
        try {
            for (_a = true, videos_1 = __asyncValues(videos); videos_1_1 = yield videos_1.next(), _b = videos_1_1.done, !_b;) {
                _d = videos_1_1.value;
                _a = false;
                try {
                    const video = _d;
                    if (video.contentDetails.hasOwnProperty("videoPublishedAt")) {
                        count += 1;
                    }
                }
                finally {
                    _a = true;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (!_a && !_b && (_c = videos_1.return)) yield _c.call(videos_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return count;
    }); };
    const getListDetails = (listId, pageToken) => __awaiter(void 0, void 0, void 0, function* () {
        let videoCount = 0;
        const response = yield service.playlistItems.list({
            part: ["contentDetails"],
            playlistId: listId,
            maxResults: 50,
            pageToken
        });
        const data = response.data;
        const videos = data.items;
        const nextPage = data.hasOwnProperty("nextPageToken") ? data.nextPageToken : false;
        const count = yield countVideos(videos);
        if (!!nextPage) {
            const nextCount = yield getListDetails(listId, nextPage);
            videoCount += nextCount;
        }
        videoCount += count;
        return videoCount;
    });
    const fetchCount = (id) => __awaiter(void 0, void 0, void 0, function* () {
        const count = yield getListDetails(id);
        return count;
    });
    console.log("Processing Fetched Playlists");
    const siteJson = new jsonUtils_1.jsonUtils("../../Apps/nginx-1.22.1/html/dndPlaylists/listCount.json");
    console.log(`Resetting JSON Cache at: ${jsonCache.viewPath()}`);
    yield jsonCache.checkPath(true);
    console.log(`Resetting Site Cache at: ${siteJson.viewPath()}`);
    yield siteJson.checkPath(true);
    const countedPlaylists = { lastUpdate: 0 };
    try {
        for (var _d = true, _e = __asyncValues(Object.keys(playlistData)), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
            _c = _f.value;
            _d = false;
            try {
                const list = _c;
                // console.log(`Fetching Data for: ${list}`);
                const count = yield fetchCount(playlistData[list].id);
                if (count > 0) {
                    countedPlaylists[list] = playlistData[list];
                    countedPlaylists[list].count = count;
                    jsonCache.set(list, countedPlaylists[list]);
                    siteJson.set(list, countedPlaylists[list]);
                }
            }
            finally {
                _d = true;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
        }
        finally { if (e_1) throw e_1.error; }
    }
    const currentDate = Date.now();
    jsonCache.set("lastUpdate", currentDate);
    siteJson.set("lastUpdate", currentDate);
    countedPlaylists.lastUpdate = currentDate;
    // const lastUpdate = await jsonCache.get("lastUpdate");
    // debg.call(`Last Updated: ${lastUpdate}`);
    // const allPlaylists = jsonCache.read();
    // jsonCache = new jsonUtils("./json/listCount.json");
    // await jsonCache.checkPath(true);
    yield logger(`Successfully Processed ${Object.keys(countedPlaylists).length} playlists`);
    return countedPlaylists;
});
exports.getPlaylistCounts = getPlaylistCounts;
//# sourceMappingURL=processPlaylists.js.map