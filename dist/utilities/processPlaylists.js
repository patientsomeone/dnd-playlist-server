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
/* MODULES */
const googleapis_1 = require("googleapis");
const fetchProperties_1 = require("./fetchProperties");
const dBug_1 = require("./dBug");
const fetchConfig_1 = require("./fetchConfig");
const getPlaylistCounts = (playlistData, jsonCache) => __awaiter(void 0, void 0, void 0, function* () {
    var e_1, _a;
    const debg = new dBug_1.dBug("utilities:getPlaylistCounts");
    const props = new fetchProperties_1.Properties({
        "youtubeApiKey": ""
    });
    debg.call("Fetching Properties");
    const properties = yield props.fetch();
    debg.call(properties.youtubeApiKey);
    const config = new fetchConfig_1.Config({ "playlists": {} });
    debg.call("Fetching Module Config");
    const listData = (yield config.fetch()).playlists;
    debg.call(listData);
    const countData = {};
    const google = new googleapis_1.GoogleApis({
        auth: properties.youtubeApiKey
    });
    const service = google.youtube("v3");
    const countVideos = (videos) => { var videos_1, videos_1_1; return __awaiter(void 0, void 0, void 0, function* () {
        var e_2, _a;
        let count = 0;
        try {
            for (videos_1 = __asyncValues(videos); videos_1_1 = yield videos_1.next(), !videos_1_1.done;) {
                const video = videos_1_1.value;
                if (video.contentDetails.hasOwnProperty("videoPublishedAt")) {
                    count += 1;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (videos_1_1 && !videos_1_1.done && (_a = videos_1.return)) yield _a.call(videos_1);
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
    yield jsonCache.checkPath(true);
    const countedPlaylists = {};
    try {
        for (var _b = __asyncValues(Object.keys(playlistData)), _c; _c = yield _b.next(), !_c.done;) {
            const list = _c.value;
            const count = yield fetchCount(playlistData[list].id);
            countedPlaylists[list] = playlistData[list];
            countedPlaylists[list].count = count;
            jsonCache.set(list, countedPlaylists[list]);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) yield _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    ;
    const currentDate = new Date();
    const oneDayPast = new Date(new Date().getTime() - (1 * 24 * 60 * 60 * 1000));
    // const lastUpdate = await jsonCache.get("lastUpdate");
    jsonCache.set("lastUpdate", Date.now());
    // debg.call(`Last Updated: ${lastUpdate}`);
    // const allPlaylists = jsonCache.read();
    // jsonCache = new jsonUtils("./json/listCount.json");
    // await jsonCache.checkPath(true);
    return countedPlaylists;
});
exports.getPlaylistCounts = getPlaylistCounts;
//# sourceMappingURL=processPlaylists.js.map