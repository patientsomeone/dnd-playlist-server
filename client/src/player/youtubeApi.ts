declare global {
    interface Window {
        YT?: typeof YT;
        onYouTubeIframeAPIReady: () => void;
    }
}

let loading: Promise<typeof YT> | undefined;

/** A single script/promise per document; failed loads can be retried. */
export function loadYouTubeApi(): Promise<typeof YT> {
    if (typeof window.YT?.Player === "function") return Promise.resolve(window.YT);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
        const previous = window.onYouTubeIframeAPIReady;
        const script = document.createElement("script");
        script.id = "reactYouTubeApi";
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        const timer = setTimeout(fail, 15000);
        function restore() {
            clearTimeout(timer);
            if (window.onYouTubeIframeAPIReady === ready) {
                if (previous) window.onYouTubeIframeAPIReady = previous;
                else Reflect.deleteProperty(window, "onYouTubeIframeAPIReady");
            }
        }
        function fail() {
            restore();
            script.remove();
            loading = undefined;
            reject(new Error("Unable to load the YouTube player API"));
        }
        function ready() {
            if (typeof window.YT?.Player !== "function") return fail();
            restore();
            try { previous?.(); } catch { /* An unrelated listener must not prevent this player. */ }
            resolve(window.YT);
        }
        window.onYouTubeIframeAPIReady = ready;
        script.onerror = fail;
        document.head.append(script);
    });
    return loading;
}
