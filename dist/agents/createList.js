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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
console.info("Runing React TS");
let youTubeReady = false;
let queue = false;
const updateFrame = (fullUrl) => {
    const list = JSON.parse(`{"${fullUrl.split("?")[1].split("&").join("\",\"").split("=").join("\":\"")}"}`).list;
    console.info("Triggering Player");
    window.player.loadPlaylist({
        listType: "playlist",
        suggestedQuality: "hd720",
        list,
        index: Math.floor(Math.random() * 5)
    });
    window.player.setShuffle({
        shufflePlaylist: 1
    });
};
window.onYouTubeIframeAPIReady = () => {
    youTubeReady = true;
    console.info("Youtube Player Ready");
    window.player = new window.YT.Player("shufflerFrame", {
        events: {
            onReady: ((evt) => {
                console.info("Player Ready");
                if (!!queue) {
                    updateFrame(queue);
                }
            })
        }
    });
    console.info("Loaded YouTube API, firing onload");
};
const injectApi = () => {
    if (!document.querySelector("head #youTubeApi")) {
        console.info("Injecting Youtube API");
        const api = "https://www.youtube.com/iframe_api";
        const scriptTag = document.createElement("script");
        scriptTag.src = api;
        scriptTag.id = "youTubeApi";
        document.querySelector("head").appendChild(scriptTag);
    }
};
const generateShuffler = (url) => {
    const shuffleParams = "&autoplay=1&loop=1&enablejsapi=1";
    const youtubeBaseline = "https://www.youtube.com/embed/videoseries?";
    const urlQuery = url.split("?")[1];
    return `${youtubeBaseline}${urlQuery}${shuffleParams}`;
};
const clickListener = (element, linkUrl) => {
    const currentElement = element.querySelector("a");
    currentElement.addEventListener("click", (evt) => {
        evt.preventDefault();
        if (!!youTubeReady) {
            updateFrame(linkUrl);
        }
        else {
            console.info(`Queueing ${linkUrl} `);
            injectApi();
            queue = linkUrl;
        }
    });
};
const getPlaylists = () => __awaiter(void 0, void 0, void 0, function* () {
    const lists = yield axios_1.default.get("/dndPlaylists/routes/playlists.json");
    /* Converting to "unknown" here because the conversion on axios.get is considered an unnecessary assertion */
    return lists;
});
const processUrl = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    const heading = document.createElement("h1");
    const list = document.createElement("dl");
    heading.innerHTML = "Dip's Organized Playlists";
    document.querySelector("#listParent").appendChild(heading);
    document.querySelector("#listParent").appendChild(list);
    const parentElement = document.querySelector("#listParent dl");
    const playlists = yield getPlaylists();
    try {
        for (var _d = true, _e = __asyncValues(Object.keys(playlists)), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
            _c = _f.value;
            _d = false;
            try {
                const listName = _c;
                const element = document.createElement("dt");
                const thisList = playlists[listName];
                const thisLink = generateShuffler(thisList);
                element.innerHTML = `<a href="?playlist=${listName}" list="${thisLink}">
            ${listName}
        </a>`;
                clickListener(element, thisLink);
                parentElement.appendChild(element);
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
});
console.info("Dip's waking up");
processUrl()
    .catch((err) => {
    console.error(err);
});
//# sourceMappingURL=createList.js.map