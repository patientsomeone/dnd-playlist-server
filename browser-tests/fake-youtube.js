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
        player.__events = events;
        player.__calls = [];
        player.__time = 37;
        player.__volume = 100;
        player.__muted = false;
        const element = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
        const frame = document.createElement('iframe'); frame.title = 'YouTube video player';
        element?.replaceWith(frame);
        for (const method of ['stopVideo', 'loadPlaylist', 'cuePlaylist', 'playVideo', 'pauseVideo', 'setShuffle', 'setLoop', 'nextVideo', 'destroy', 'setVolume', 'mute', 'unMute']) {
            player[method] = (...args) => {
                window.__playerCalls.push({method, args});
                player.__calls.push({method, args});
                if (window.__throwPlayerMethods) throw new Error('Fixture player failure');
                if (method === 'destroy') frame.remove();
                if (['setVolume', 'mute', 'unMute'].includes(method) && window.__throwAudioMethods) throw new Error('Fixture audio failure');
                if (method === 'setVolume') player.__volume = args[0];
                if (method === 'mute') player.__muted = true;
                if (method === 'unMute') player.__muted = false;
                if (method === 'loadPlaylist') state = 3;
                if (method === 'cuePlaylist') state = 5;
                if (method === 'playVideo') events.onStateChange({data: 1});
                if (method === 'pauseVideo' && !window.__delayPauseEvents) events.onStateChange({data: 2});
            };
        }
        player.getIframe = () => frame;
        player.getCurrentTime = () => player.__time;
        player.getPlayerState = () => state;
        player.getVideoData = () => ({title: 'Fixture video'});
        player.getVolume = () => { if (window.__throwAudioMethods) throw new Error('Fixture audio failure'); return player.__volume; };
        player.isMuted = () => player.__muted;
        window.__playerInstances.push(player);
        return player;
    }
};
window.onYouTubeIframeAPIReady();
