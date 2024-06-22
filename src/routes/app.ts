/* eslint-disable @typescript-eslint/no-misused-promises, no-console */
import {config} from "dotenv";
import express, {Express, Request, Response, Errback} from "express";
// import path from "path";
import cors from "cors";
import {jsonUtils} from "../utilities/jsonUtils";
// import listCount from "../../json/listCount.json";
import {log} from "../utilities/log";
// import React from "react";
import {renderToReadableStream, renderToStaticMarkup} from "react-dom/server";
import {reactResponse} from "../index";
// import {HelloWorld} from "../views/helloWorld";
import {reactRoutes} from "./reactRoutes";
import {fetchLists} from "../agents/refreshList";
import {srcPath} from "../utilities/srcPath";
import {anyObject, anyStandard} from "../.types";

config();

const app: Express = express();

app.use(express.json());
app.use(cors());
app.use((err, req: Request, res: Response, next) => {
    console.log(`Sending Error for ${req.route as string}`);
    res.status(err.status || 500);
    res.send(err);
});

app.use("/", (req: Request, res: Response, next) => {
    const hasQuery = Object.keys(req.query).length > 0;
    console.log(`Sending Response for ${req.path}${!hasQuery ? "" : `?${req.query.toString()}`}`);
    next();
});

const respond = (res: Response, data: anyStandard) => {
    console.log(`Responding to request for ${res.location.toString()}`);
    return res.status(200).send(data);
};

const time = new Date(Date.now());

console.log(`Starting application at: ${time.toLocaleString("en-US", {timeZone: "PDT"})}`);

app.get("/", (request: Request, response: Response) => {
    const mainPath = "./public/playlists.html";
    console.log(`Attempting to fetch ${srcPath(mainPath)}`);
    response.sendFile(srcPath(mainPath));
});

app.get("/createList.js", (request: Request, response: Response) => {
    const mainPath = "./public/createList.js";
    console.log(`Attempting to fetch ${srcPath(mainPath)}`);
    response.sendFile(srcPath(mainPath));
});

app.get("/favicon.ico", (request: Request, response: Response) => {
    const mainPath = "./public/favicon.ico";
    console.log(`Attempting to fetch ${srcPath(mainPath)}`);
    response.sendFile(srcPath(mainPath));
});

app.get("/refreshPlaylists", async (request: Request, response: Response) => {
    const res = await fetchLists();
    console.log("Refreshing Playlists");
    respond(response, res);
});

app.get("/listCount", (request: Request, response: Response, next) => {
    try {
        const getJson = new jsonUtils("json/listCount.json");
        const res = getJson.read();
    
        console.log(`Returning Response on ${request.path}: Query Parameter to follow`);
        console.log(request.query);
    
        respond(response, res);
    } catch (error) {
        next();
    }
});

for (const key in reactRoutes) {
    if (reactRoutes.hasOwnProperty(key)) {
        app.get(`/${key}`, async (request: Request, response: Response) => {
            const res = await reactResponse(reactRoutes[key], request);
    
            respond(response, res);
        });
    }
}

const port = process.env.PORT || 8000;

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

export {app};