/* eslint-disable @typescript-eslint/no-misused-promises, no-console */
import {config} from "dotenv";
import express, {Express, Request, Response, Errback} from "express";
// import path from "path";
import cors from "cors";
import {jsonUtils} from "./utilities/jsonUtils";
// import listCount from "../../json/listCount.json";
import {log} from "./utilities/log";
// import React from "react";
import {renderToReadableStream, renderToStaticMarkup} from "react-dom/server";
import {reactResponse} from "./index";
import {HelloWorld} from "./views/helloWorld";
import {reactRoutes} from "./routes/reactRoutes";
import {fetchLists} from "./agents/refreshList";

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

const respond = (res, data) => res.status(200).send(data);

app.get("/", async (request: Request, response: Response) => {
    const res = await reactResponse(HelloWorld, request);

    respond(response, res);
});

app.get("/refreshPlaylists", async (request: Request, response: Response) => {
    const res = await fetchLists();

    respond(response, res);
});

app.get("/listCount", (request: Request, response: Response, next) => {
    try {
        const getJson = new jsonUtils("json/listCount.json");
        const res = getJson.read();
    
        console.log("Returning Response: Query Parameter to follow");
        console.log(request.query);
    
        respond(response, res);
    } catch (error) {
        next();
    }
});

// app.get("/testJson", async (request: Request, response: Response) => {
//     response.send(listCount)
// });

// app.get("/testReact", async (request: Request, response: Response) => {
//     const res = await reactResponse(HelloWorld, request);

//     respond(response, res);
//     // response.send(res);
// });

for (const key in reactRoutes) {
    if (reactRoutes.hasOwnProperty(key)) {
        app.get(`/${key}`, async (request: Request, response: Response) => {
            const res = await reactResponse(reactRoutes[key], request);
    
            respond(response, res);
        });
    }
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});