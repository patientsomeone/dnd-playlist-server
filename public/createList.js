// src/agents/createList.ts
var test = false;
var log = (msg) => {
  if (!!test) {
    console.log(msg);
  }
};
log("Runing createList.ts");
var youTubeReady = false;
var queue = false;
window.noShuffle = false;
var setHeaderState = (state) => {
  const header = document.querySelector("#frameParent h2");
  if (!header) return;
  const parts = header.innerHTML.split(":");
  const videoName = parts.length > 1 ? parts.slice(1).join(":").trim() : header.innerHTML;
  const newState = `${state.slice(0, 1).toUpperCase()}${state.slice(1)}`;
  const newTitle = `${newState}: ${videoName}`;
  header.classList.remove("paused", "playing", "buffering");
  header.classList.add(state);
  header.innerHTML = newTitle;
};
var playerStateChange = (event) => {
  const ytStates = window.YT?.PlayerState;
  if (!ytStates) return;
  if (event.data === ytStates.PLAYING) {
    if (!!window.frameUpdated) {
      window.frameUpdated = false;
      log("Setting shuffle");
      if (!window.noShuffle) {
        try {
          window.player.setShuffle?.(true);
        } catch (e) {
        }
      }
      log("Setting Loop");
      try {
        window.player.setLoop?.(true);
      } catch (e) {
      }
    }
    return setHeaderState("playing");
  }
  if (event.data === ytStates.PAUSED) {
    return setHeaderState("paused");
  }
  log("Player State Changed");
  return setHeaderState("buffering");
};
window.onPlayerReady = (evt) => {
  log("On Player Ready Called");
};
window.onYouTubeIframeAPIReady = () => {
  youTubeReady = true;
  log("Youtube Player Ready");
  window.player = new window.YT.Player("shufflerFrame", {
    playerVars: {
      autoplay: 1,
      loop: 1,
      enablejsapi: 1
    },
    events: {
      onReady: ((evt) => {
        log("Player Ready");
        if (!!queue) {
          updateFrame(queue);
        }
      }),
      onStateChange: playerStateChange,
      onError: (evt) => {
        const videoData = window.player?.getVideoData?.();
        log({ msg: "Player error", error: evt.data, videoData });
        try {
          window.player.nextVideo();
        } catch (e) {
        }
      }
    }
  });
  log("Loaded YouTube API, firing onload");
};
var injectApi = async () => {
  if (!document.querySelector("head #youTubeApi")) {
    log("Injecting Youtube API");
    const api = "https://www.youtube.com/iframe_api";
    const scriptTag = document.createElement("script");
    scriptTag.src = api;
    scriptTag.id = "youTubeApi";
    document.querySelector("head")?.appendChild(scriptTag);
  }
};
var updateFrame = async (config) => {
  window.frameUpdated = true;
  const playerTitle = document.querySelector("#frameParent h2");
  log("Triggering Player");
  log(`Updating iFrame with count: ${config.count}`);
  try {
    window.player.stopVideo?.();
  } catch (e) {
  }
  if (playerTitle) playerTitle.innerHTML = `Buffering: ${config.name}`;
  window.noShuffle = config.name.toLowerCase().indexOf("boss") >= 0;
  const iNum = window.noShuffle ? 0 : Math.floor(Math.random() * config.count);
  try {
    window.player.loadPlaylist({
      listType: "playlist",
      suggestedQuality: "hd720",
      list: config.id,
      index: iNum
    });
  } catch (e) {
    log("Error loading playlist into player");
  }
};
var clickListener = (element, config) => {
  const currentElement = element.querySelector("a");
  if (!currentElement) return;
  currentElement.addEventListener("click", (evt) => {
    evt.preventDefault();
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "click", {
          event_category: "button",
          event_label: config.name
        });
      }
    } catch (e) {
    }
    if (!!youTubeReady) {
      updateFrame(config);
    } else {
      log(`Queueing Playlist ${config.id} `);
      injectApi();
      queue = config;
    }
  });
};
var refreshLists = async () => {
  const statusMsg = document.querySelector("#frameParent > h2");
  if (!statusMsg) return;
  statusMsg.innerHTML = "Please Wait: Refreshing Playlist Data...";
  statusMsg.classList.add("paused");
};
var completeRefresh = async () => {
  const statusMsg = document.querySelector("#frameParent > h2");
  if (!statusMsg) return;
  statusMsg.innerHTML = "Ready to Play";
  statusMsg.classList.remove("paused");
};
var processUrl = async () => {
  const listData = await (async () => {
    const dataResp = await fetch("/listCount");
    const processed = await dataResp.json();
    const lastUpdate2 = processed.hasOwnProperty("lastUpdate") && processed.lastUpdate;
    log(`JSON Cache Last Updated: ${new Date(lastUpdate2)}`);
    if (!!lastUpdate2 && Date.now() <= lastUpdate2 + 12 * 60 * 60 * 1e3) {
      return processed;
    }
    log("Refreshing Playlist Data");
    await refreshLists();
    let refreshedData = await fetch("/refreshPlaylists");
    let refProcessed = await refreshedData.json();
    const isProcessing = refProcessed.hasOwnProperty("status") && refProcessed.status === "processing";
    log(`Refresh is Processing: ${isProcessing}`);
    if (!!isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 3e3));
      refreshedData = await fetch("/refreshPlaylists");
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
    `;
  document.querySelector("#listParent")?.appendChild(heading);
  document.querySelector("#listParent")?.appendChild(list);
  document.querySelector("#listParent")?.appendChild(updated);
  if (!lastUpdate || Date.now() >= lastUpdate + 12 * 60 * 60 * 1e3) {
    document.querySelector("#lastUpdated")?.classList.add("expired");
    console.warn(`Playlist data may need to be refreshed`);
  } else {
    document.querySelector("#lastUpdated")?.classList.add("fresh");
    console.log("Playlist data appears up to date");
  }
  const sorted = Object.keys(listData).sort().reduce((item, key) => {
    item[key] = listData[key];
    return item;
  }, {});
  const parentElement = document.querySelector("#listParent dl");
  if (!parentElement) return;
  for await (const listName of Object.keys(sorted)) {
    if (listName === "lastUpdate") {
      break;
    }
    const element = document.createElement("dt");
    const thisList = sorted[listName];
    element.innerHTML = `<a href="${thisList.link}" id="${thisList.id}" count="${thisList.count}">
            ${listName}
        </a>`;
    clickListener(element, {
      id: thisList.id,
      count: thisList.count,
      name: listName
    });
    parentElement.appendChild(element);
  }
};
log("Dip's waking up from teh sleep");
processUrl().catch((err) => {
  console.error(err);
});
//# sourceMappingURL=createList.js.map
