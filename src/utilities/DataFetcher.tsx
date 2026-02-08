import React, {useState, useEffect} from "react";
import { listData, playlistProcessed } from "../.types";

declare global {
    interface Window {
        listData?: listData
    }
}


type dataFetcherProps = {
    onDataLoaded: (data: playlistProcessed) => void;
};

const DataFetcher: React.FC<dataFetcherProps> = ({onDataLoaded}) => {
        const pathMap = {
            pathfinderBuilds: {
              count: '/pfCount',
              refresh: '/pfRefresh',
            },
            dipsLists: {
              count: '/json/UCr7k176h5b1JwD9yXpSUkGA.json',
              refresh: '/refreshPlaylists',
            },
            standard: {
              count: '/listCount',
              refresh: '/refreshPlaylists',
            },
          };

          const processUrl = async () => {
            let endpoint: string;
            const listDataEndpoint: string | false = window.listData && window.listData.listEndpoint ? window.listData.listEndpoint : false;
            const processedPathMap: {count: string} | false = listDataEndpoint &&  pathMap.hasOwnProperty(listDataEndpoint) ? pathMap[listDataEndpoint] : false;

            if (!!processedPathMap) {
                console.log(`Fetching data from ${listDataEndpoint}`);
                endpoint = processedPathMap.count;
            } else {
                console.log('Fetching data from default');
                endpoint = pathMap.standard.count;
            }

            try {
                const response = await fetch(endpoint);
                const data: playlistProcessed = await response.json();
                onDataLoaded(data);
            } catch (error) {
                console.error(`Error fetching data: ${error}`);
            }
          }

          useEffect(() => {
            processUrl();
          }, [onDataLoaded]);

          return null;
}

export default DataFetcher;