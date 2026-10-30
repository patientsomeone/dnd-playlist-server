window.__playerCalls = [];
window.__playerInstances = [];
window.YT = {
    PlayerState: {UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5},
    Player: function (elementId, options) {
        window.__playerOptions = options; window.__playerCreations = (window.__playerCreations || 0) + 1;
        let state = -1;
        const events = {...options.events, onStateChange: (event) => {
            state = event.data;
            options.events.onStateChange?.(event);
        }};
        window.__playerEvents = events;
        const player = {};
        const element = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
        const frame = document.createElement('iframe'); frame.title = 'YouTube video player';
        element?.replaceWith(frame);
        for (const method of ['stopVideo', 'loadPlaylist', 'playVideo', 'pauseVideo', 'setShuffle', 'setLoop', 'nextVideo', 'destroy']) {
            player[method] = (...args) => {
                window.__playerCalls.push({method, args});
                if (window.__throwPlayerMethods) throw new Error('Fixture player failure');
                if (method === 'destroy') frame.remove();
                if (method === 'loadPlaylist') state = 3;
                if (method === 'playVideo') events.onStateChange({data: 1});
                if (method === 'pauseVideo') events.onStateChange({data: 2});
            };
        }
        player.getIframe = () => frame;
        player.getCurrentTime = () => 37;
        player.getPlayerState = () => state;
        player.getVideoData = () => ({title: 'Fixture video'});
        window.__playerInstances.push(player);
        return player;
    }
};
window.onYouTubeIframeAPIReady();
