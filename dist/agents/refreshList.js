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
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLists = void 0;
const fetchPlaylists_1 = require("../utilities/fetchPlaylists");
const fsUtils_1 = require("../utilities/fsUtils");
const dateStamp_1 = require("../utilities/dateStamp");
const fetchLists = () => __awaiter(void 0, void 0, void 0, function* () {
    const listData = yield (0, fetchPlaylists_1.fetchChannelPlaylists)("UCr7k176h5b1JwD9yXpSUkGA");
    return listData;
});
exports.fetchLists = fetchLists;
const initialize = () => __awaiter(void 0, void 0, void 0, function* () {
    const logFile = new fsUtils_1.FsUtils(`./logs/${(0, dateStamp_1.dateStamp)()}_playlistLogs.txt`);
    const logger = logFile.logFile;
    try {
        yield logger("Fetching Playlists");
        return (0, exports.fetchLists)()
            .catch((err) => {
            console.error(err);
        });
    }
    catch (error) {
        throw (error);
    }
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield initialize();
        // await executeArguments({
        //     start: initialize
        // });
    }
    catch (error) {
        throw (error);
    }
}))();
//# sourceMappingURL=refreshList.js.map