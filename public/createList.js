const test = true;

const log = (msg) => {
    if (!!test) {
        return console.log(msg);
    }
}

log("Runing createList.js");

let youTubeReady = false;
let queue = false;

window.noShuffle = false;

const playerStateChange = (event) => {
    const setClass = (state) => {
        const header = document.querySelector("#frameParent h2");
        const videoName = header.innerHTML.split(":")[1];
        const newState = `${state.slice(0, 1).toUpperCase()}${state.slice(1)}`;
        const newTitle = `${newState}: ${videoName}`;

        header.classList.remove("paused", "playing", "buffering");
        header.classList.add(state);
        header.innerHTML = newTitle;
    }

    const ytStates = window.YT.PlayerState;

    if (event.data === ytStates.PLAYING) {
        if (!!window.frameUpdated) {
            window.frameUpdated = false;
            log("Setting shuffle");
            if (!noShuffle) {
                player.setShuffle(true);
            }
            log("Setting Loop");
            player.setLoop(true);
        }
        return setClass("playing");
    }

    if (event.data === ytStates.PAUSED) {
        return setClass("paused");
    }

    log("Player State Changed");
    return setClass("buffering");
};

window.onPlayerReady = (evt) => {
    log("On Player Ready Called");
}

window.onYouTubeIframeAPIReady = () => {
    youTubeReady = true;

    log("Youtube Player Ready");

    window.player = new YT.Player("shufflerFrame", {
        playerVars: {
            autoplay: 1,
            loop: 1
        },
        events: {
            onReady: ((evt) => {
                log("Player Ready");

                if (!!queue) {
                    updateFrame(queue);
                };
            }),
            onStateChange: playerStateChange
        }
    });
    log("Loaded YouTube API, firing onload");
}

const getCount = async(listUrl) => {

};

const injectApi = async(url) => {
    if (!document.querySelector("head #youTubeApi")) {
        log("Injecting Youtube API");
        const api = "https://www.youtube.com/iframe_api";
        const scriptTag = document.createElement("script");

        scriptTag.src = api;
        scriptTag.id = "youTubeApi";
        document.querySelector("head").appendChild(scriptTag);
    }
};


const updateFrame = async(config) => {
    window.frameUpdated = true;
    const playerTitle = document.querySelector("#frameParent h2");
    log("Triggering Player");

    log(`Updating iFrame with count: ${config.count}`);
    player.stopVideo();

    playerTitle.innerHTML = (`Buffering: ${config.name}`);

    window.noShuffle = config.name.toLowerCase().indexOf("boss") >= 0;
    const iNum = window.noShuffle ? 0 : Math.floor(Math.random() * config.count);

    player.loadPlaylist({
        listType: "playlist",
        suggestedQuality: "hd720",
        list: config.id,
        index: iNum
    });

}

const generateShuffler = (url) => {
    const shuffleParams = "&autoplay=1&loop=1&enablejsapi=1";
    const youtubeBaseline = "https://www.youtube.com/embed/videoseries?";
    const urlQuery = url.split("?")[1];
    return `${youtubeBaseline}${urlQuery}${shuffleParams}`;
}

const clickListener = (element, config) => {
    const currentElement = element.querySelector("a");
    currentElement.addEventListener("click", (evt) => {
        evt.preventDefault();
        window.gtag("event", "click", {
            event_category: "button",
            event_label: config.name
        })
        if (!!youTubeReady) {
            updateFrame(config);
        } else {
            log(`Queueing Playlist ${config.id} `);
            injectApi();
            queue = config;
        }
    });
}

const refreshLists = async () => {
    const statusMsg = document.querySelector("#frameParent > h2");

    statusMsg.innerHTML = "Please Wait: Refreshing Playlist Data..."
    statusMsg.classList.add("paused");
}

const completeRefresh = async () => {
    const statusMsg = document.querySelector("#frameParent > h2");

    statusMsg.innerHTML = "Ready to Play"
    statusMsg.classList.remove("paused");
}

const processUrl = async() => {
    const listData = await (async () => {
        const data = await fetch("listCount.json");
        const processed = await data.json();
        const lastUpdate = processed.hasOwnProperty("lastUpdate") && processed.lastUpdate;
        
        log(`JSON Cache Last Updated: ${new Date(lastUpdate)}`);

        if (!!lastUpdate && Date.now() <= (lastUpdate + (12 * 60 * 60 * 1000))) {
            return processed;
        }

        log("Refreshing Playlist Data");

        await refreshLists();
        let refreshedData = await fetch("/dndReactApp/refreshPlaylists");
        let refProcessed = await refreshedData.json();
        const isProcessing = refProcessed.hasOwnProperty("status") && refProcessed.status === "processing";

        log(`Refresh is Processing: ${isProcessing}`);

        if (!!isProcessing) {
            await setTimeout(() => {
                log("Timeout Ended");
                return Promise.resolve();
            }, 3000);
            
            refreshedData = await fetch("/dndReactApp/refreshPlaylists");
            refProcessed = await refreshedData.json();
        }
        
        await completeRefresh();
        return refProcessed;
    })();

    const lastUpdate = listData.lastUpdate;

    const heading = document.createElement("h1");
    const updated = document.createElement("sub");
    const list = document.createElement("dl");
    heading.innerHTML = "Dip's Organized Playlists";
    updated.id = "lastUpdated";
    updated.innerHTML = `Last Updated: ${new Date(lastUpdate).toLocaleString()}
    <br>
    Author: Joshua Robinson
    `

    document.querySelector("#listParent").appendChild(heading);
    document.querySelector("#listParent").appendChild(list);
    document.querySelector("#listParent").appendChild(updated);

    if (!lastUpdate || Date.now() >= (lastUpdate + (12 * 60 * 60 * 1000))) {
        document.querySelector("#lastUpdated").classList.add("expired");
        console.warn(`Playlist data may need to be refreshed`);
    } else {
        document.querySelector("#lastUpdated").classList.add("fresh");
        console.log("Playlist data appears up to date");
    }
    
    const sorted = Object.keys(listData).sort().reduce((item, key) => {
        item[key] = listData[key];
        return item;
    }, {});
    

    const parentElement = document.querySelector("#listParent dl");

    for await (const listName of Object.keys(sorted)) {
        if (listName === "lastUpdate") {
            break;
        }

        const element = document.createElement("dt");
        const thisList = sorted[listName];

        element.innerHTML = `<a href="${thisList.link}" id="${thisList.id}" count="${thisList.count}">
            ${listName}
        </a>`

        clickListener(element, {
            id: thisList.id,
            count: thisList.count,
            name: listName
        });
        parentElement.appendChild(element);
    }
}

const injectGoogleAnalytics = () => {
    if (!document.querySelector("head #gtag")) {
        log("Injecting Google Analytics");
        const gtag = "https://www.googletagmanager.com/gtag/js?id=G-6CR6NWLDCB";
        const scriptTag = document.createElement("script");

        scriptTag.src = gtag;
        scriptTag.id = "gtag";
        document.querySelector("head").appendChild(scriptTag);

        window.dataLayer = window.dataLayer || [];
        window.gtag = (...args) => {
            log("Pushing Data to GA");
            dataLayer.push(args);
        };
        window.gtag('js', new Date());
        window.gtag('config', 'G-6CR6NWLDCB'
            /* , {
                        send_page_view: false
                    } */
        );
        // window.gtag("event", "page_view", {
        //     page_title: document.title,
        //     page_location: location.href
        // })
    }
};

log("Dip's waking up");
// injectGoogleAnalytics();
processUrl();