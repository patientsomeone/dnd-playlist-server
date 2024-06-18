import axios from "axios";

declare global {
    interface Window {
        onYouTubeIframeAPIReady;
        player;
        YT;
    }
}

console.info("Runing React TS");

let youTubeReady = false;
let queue: string | false = false;

const updateFrame = (fullUrl: string) => {
    const list = JSON.parse(`{"${fullUrl.split("?")[1].split("&").join("\",\"").split("=").join("\":\"")}"}`).list as string;

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

const generateShuffler = (url: string): string => {
    const shuffleParams = "&autoplay=1&loop=1&enablejsapi=1";
    const youtubeBaseline = "https://www.youtube.com/embed/videoseries?";
    const urlQuery = url.split("?")[1];
    return `${youtubeBaseline}${urlQuery}${shuffleParams}`;
};

const clickListener = (element: Element, linkUrl: string) => {
    const currentElement = element.querySelector("a") as Element;
    currentElement.addEventListener("click", (evt) => {
        evt.preventDefault();
        if (!!youTubeReady) {
            updateFrame(linkUrl);
        } else {
            console.info(`Queueing ${linkUrl} `);
            injectApi();
            queue = linkUrl;
        }
    });
};

const getPlaylists = async (): Promise<{[key: string]: string;}> => {
    const lists = await axios.get("/dndPlaylists/routes/playlists.json");

    /* Converting to "unknown" here because the conversion on axios.get is considered an unnecessary assertion */
    return lists as unknown as {[key: string]: string;};
};

const processUrl = async() => {
    const heading = document.createElement("h1");
    const list = document.createElement("dl");
    heading.innerHTML = "Dip's Organized Playlists";

    document.querySelector("#listParent").appendChild(heading);
    document.querySelector("#listParent").appendChild(list);

    const parentElement = document.querySelector("#listParent dl");

    const playlists = await getPlaylists();

    for await (const listName of Object.keys(playlists)) {
        const element = document.createElement("dt");
        const thisList = playlists[listName];
        const thisLink = generateShuffler(thisList);

        element.innerHTML = `<a href="?playlist=${listName}" list="${thisLink}">
            ${listName}
        </a>`;

        clickListener(element, thisLink);
        parentElement.appendChild(element);
    }
};


console.info("Dip's waking up");
processUrl()
    .catch((err) => {
        console.error(err);
    });