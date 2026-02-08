import React from "react";
import {playlistProcessed, individualPlaylist} from "../.types"

type PlayListerProps = {
    playlist: playlistProcessed | null;
    onVideoSelect: (item: individualPlaylist, name: string) => void;
};

const PlayLister: React.FC<PlayListerProps> = ({playlist, onVideoSelect}) => {
    if (!playlist) return null;

    const sortedKeys = Object.keys(playlist).filter((key) => key !== "lastUpdate").sort();

    return (
        <dl id="listParent">
            {
                sortedKeys.map((listName) => {
                    const thisList = playlist[listName];
                    return (
                        <dt key={thisList.id}>
                            <a href={thisList.link}
                                id={thisList.id}
                                data-count={thisList.count}
                                onClick={(e) => {
                                    e.preventDefault();
                                    onVideoSelect(thisList, listName);
                                }}
                            >
                                {listName}
                            </a>
                        </dt>
                    )
                })}
        </dl>
    );
};

export default PlayLister