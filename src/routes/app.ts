/* eslint-disable @typescript-eslint/no-misused-promises, no-console */
import {config} from "dotenv";
import express, {Express, Request, Response, Errback} from "express";
// import path from "path";
import cors from "cors";
import {jsonUtils} from "../utilities/jsonUtils";
// import listCount from "../../json/listCount.json";
import {log, logLine} from "../utilities/log";
// import React from "react";
import {renderToReadableStream, renderToStaticMarkup} from "react-dom/server";
import {reactResponse} from "../index";
// import {HelloWorld} from "../views/helloWorld";
import {reactRoutes} from "./reactRoutes";
import {fetchLists} from "../agents/refreshList";
import {srcPath} from "../utilities/srcPath";
import {anyObject, anyStandard, playlistQueries, stringObject} from "../.types";
import {currentTime} from "../utilities/timeConversion";
import {queryProcessor} from "../utilities/queryProcessor";
import {fetchEnv} from "../utilities/fetchEnv";

config();

const app: Express = express();
const isProduction = !!process.env.DO_ENV;

app.use(express.json());
app.use(cors());
app.use((err, req: Request, res: Response, next) => {
    console.log("\x1b[31m%s\x1b[0m", `Sending Error for ${req.route as string}`);
    res.status(err.status || 404);
    res.send(err);
});

app.use("/", (req: Request, res: Response, next) => {
    const hasQuery = Object.keys(req.query).length > 0;
    console.log(`Sending Response for ${req.hostname} | ${req.path}`);
    if (hasQuery) {
        console.log(req.query);
    }
    console.log(`Response: ${res.statusMessage || "OK"} | ${res.statusCode}`);
    next();
});

app.use(express.static("./public/"), (req: Request, res: Response, next) => {
    console.log(`Attempting to fetch ${req.path}`);
    if (req.path.indexOf("../") > 0) {
        console.error("\x1b[31m%s\x1b[0m", `Pathing attempt detected from ${req.originalUrl}`);
        res.send("No pathing please");
    }
    next();
});

const respond = (req: Request, res: Response, data: anyStandard) => {
    console.log(`Responding to computed request from: ${req.path} at ${currentTime()}`);
    return res.status(200).send(data);
};

console.log(`Application started at: ${currentTime()}`);

app.get("/", (request: Request, response: Response) => {
    const mainPath = "./public/playlists.html";
    console.log(`Attempting to fetch ${srcPath(mainPath)}`);
    response.sendFile(srcPath(mainPath));
});

app.get("/pathfinderBuilds", (request: Request, response: Response) => {
    const mainPath = "./public/pathfinderBuilds.html";
    console.log(`Attempting to fetch ${srcPath(mainPath)}`);
    response.sendFile(srcPath(mainPath));
});

app.get("/favicon.ico", (request: Request, response: Response) => {
    const mainPath = "./public/favicon.ico";
    console.log(`Attempting to fetch ${srcPath(mainPath)}`);
    response.sendFile(srcPath(mainPath));
});

app.get("/refreshPlaylists", async (request: Request, response: Response) => {
    console.log(`Refreshing Playlists from ${request.path}: Query Parameters to follow`);
    console.log(request.query);

    // Apply default query
    const query = await queryProcessor(request.query as stringObject);

    // TODO: Separate endpoints to query based
    
    const res = await fetchLists(query);
    console.log("Refreshing Playlists");
    respond(request, response, res);
});

app.get("/listCount", (request: Request, response: Response, next) => {
    try {
        const getJson = new jsonUtils("public/json/listCount.json");
        const res = getJson.read();
    
        console.log(`Returning Response on ${request.path}: Query Parameter to follow`);
        console.log(request.query);
    
        respond(request, response, res);
    } catch (error) {
        next();
    }
});

// [] Refactor to {[key: string]: {title: string, component: React.ComponentType}}
// for (const route in reactRoutes) {
//     if (reactRoutes.hasOwnProperty(route)) {
//         app.get(`/${route}`, async (request: Request, response: Response) => {
//             const res = await reactResponse(reactRoutes[route], request);
    
//             respond(request, response, res);
//         });
//     }
// }

for (const route in reactRoutes) {
    if (reactRoutes.hasOwnProperty(route)) {
        app.get(`/${route}`, async (request: Request, response: Response) => {
            const res = await reactResponse(reactRoutes[route]);
    
            respond(request, response, res);
        });
    }
}

app.get("/*", (req: Request, res: Response) => {
    console.log("\x1b[31m%s\x1b[0m", `Sending Error for ${req.path}`);

    res.status(404).send("This is not the page you are looking for...");
});

const port = process.env.PORT || 8000;

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

export {app};