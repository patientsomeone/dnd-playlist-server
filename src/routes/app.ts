
import "../utilities/environment";
import express, {Express, Request, Response, NextFunction, Errback} from "express";
// import path from "path";
import cors from "cors";
import {getPlaylistCache} from "../utilities/playlistCacher";
// import listCount from "../../json/listCount.json";
import {log, logLine} from "../utilities/log";
// import React from "react";
import {reactResponse} from "../index";
// import {HelloWorld} from "../views/helloWorld";
import {reactRoutes} from "./reactRoutes";
import {fetchLists} from "../agents/refreshList";
import {srcPath} from "../utilities/srcPath";
import {anyObject, anyStandard, playlistQueries, stringObject} from "../.types";
import {currentTime} from "../utilities/timeConversion";
import {queryProcessor} from "../utilities/queryProcessor";
import {fetchEnv} from "../utilities/fetchEnv";
import {InvalidPlaylistQuery} from "../utilities/sqlitePlaylistCache";
import {createReactClientRouter} from "./reactClient";

const app: Express = express();
// Preserve Express 4's nested-query parsing so malformed channel objects are rejected.
app.set("query parser", "extended");
const isProduction = !!process.env.DO_ENV;

app.use(express.json());
app.use(cors());

app.use("/", (req: Request, res: Response, next) => {
    const hasQuery = Object.keys(req.query).length > 0;
    console.log(`Sending Response for ${req.hostname} | ${req.path}`);
    if (hasQuery) {
        console.log(req.query);
    }
    console.log(`Response: ${res.statusMessage || "OK"} | ${res.statusCode}`);
    next();
});

app.use("/react", createReactClientRouter(srcPath("dist/client")));

app.use(express.static(srcPath("public")), (req: Request, res: Response, next) => {
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

app.get("/refreshPlaylists", async (request: Request, response: Response, next) => {
    response.set("Cache-Control", "no-store");
    console.log(`Refreshing Playlists from ${request.path}: Query Parameters to follow`);
    console.log(request.query);

    // Apply default query
    try {
        const query = await queryProcessor(request.query);
        const res = await fetchLists(query);
        respond(request, response, res);
    } catch (error) {
        if (error instanceof InvalidPlaylistQuery) return next(error);
        response.status(502).json({error: "Unable to refresh playlists"});
    }
});

app.get("/listCount", async (request: Request, response: Response, next) => {
    try {
        const query = await queryProcessor(request.query);
        const getJson = getPlaylistCache(query.channelId);
        const res = await getJson.read();

        console.log(`Returning Response on ${request.path}: Query Parameter to follow`);
        console.log(request.query);

        response.set("Cache-Control", "no-store");
        respond(request, response, res);
    } catch (error) {
        next(error);
    }
});

app.get("/cacheState", async (request: Request, response: Response, next) => {
    response.set("Cache-Control", "no-store");
    try {
        const query = await queryProcessor(request.query);
        response.json(await getPlaylistCache(query.channelId).state());
    } catch (error) {
        next(error);
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

for (const [route, definition] of Object.entries(reactRoutes)) {
        app.get(`/${route}`, (request: Request, response: Response) => {
            const res = reactResponse(definition.title);

            respond(request, response, res);
        });
}

app.get("/{*unmatched}", (req: Request, res: Response) => {
    console.log("\x1b[31m%s\x1b[0m", `Sending Error for ${req.path}`);

    res.status(404).send("This is not the page you are looking for...");
});

const port = process.env.PORT || 8000;

// Keep a single JSON error contract for validation and cache failures.
app.use((error: unknown, request: Request, response: Response, next: NextFunction) => {
    const status = error instanceof InvalidPlaylistQuery ? 400 : 500;
    response.status(status).json({error: error instanceof InvalidPlaylistQuery ? error.message : "Unable to read playlist cache"});
});

if (require.main === module) {
    console.log(`Application started at: ${currentTime()}`);
    app.listen(port, () => {
        console.log(`Listening on port ${port}`);
    });
}

export {app};
