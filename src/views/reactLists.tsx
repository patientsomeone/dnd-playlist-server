import DataFetcher from "../utilities/DataFetcher";
import PlayLister from "../components/Playlister";
import React, {useState} from "react";
import {individualPlaylist, playlistProcessed} from "../.types";
import {log} from "../utilities/log";

export const ReactLists: React.FC = () => {
    // Manage React State
    const [playlistData, setPlaylistData] = useState<playlistProcessed | null>(null);

    // Handle Data Loading
    const handleDataLoaded = (data: playlistProcessed) => {
        setPlaylistData(data);
    };

    const handleVideoSelect = (item: individualPlaylist, name: string) => {
        console.log(item, name);
    }

    // Render UI
    return (
        <div>
            <DataFetcher onDataLoaded={handleDataLoaded}/>
            <PlayLister playlist={playlistData} onVideoSelect={handleVideoSelect}/>
        </div>
    )


};