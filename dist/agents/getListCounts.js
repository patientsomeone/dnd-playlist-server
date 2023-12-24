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
/* MODULES */
const googleapis_1 = require("googleapis");
const jsonUtils_1 = require("../utilities/jsonUtils");
const fetchProperties_1 = require("../utilities/fetchProperties");
const dBug_1 = require("../utilities/dBug");
const fetchConfig_1 = require("../utilities/fetchConfig");
(() => __awaiter(void 0, void 0, void 0, function* () {
    var e_1, _a;
    try {
        const debg = new dBug_1.dBug("utilities:getListCounts");
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
        const fetchCount = (link) => __awaiter(void 0, void 0, void 0, function* () {
            const listId = (yield new URLSearchParams(link.split("?")[1])).get("list");
            const count = yield getListDetails(listId);
            const listCount = {
                id: listId,
                count
            };
            return listCount;
        });
        const jsonCache = new jsonUtils_1.jsonUtils("./json/listCount.json");
        yield jsonCache.checkPath(true);
        try {
            for (var _b = __asyncValues(Object.keys(listData)), _c; _c = yield _b.next(), !_c.done;) {
                const list = _c.value;
                const data = yield fetchCount(listData[list]);
                const updatedObj = {
                    link: listData[list],
                    count: data.count,
                    id: data.id
                };
                countData[list] = updatedObj;
                jsonCache.set(list.split(".").join("\\."), updatedObj);
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
    }
    catch (error) {
        console.error(error);
    }
}))();
//# sourceMappingURL=getListCounts.js.map