import {config} from "dotenv";
import express, {Express, Request, Response, Errback} from "express";
// import path from "path";
import cors from "cors";
import {jsonUtils} from "../utilities/jsonUtils"
import listCount from "../../json/listCount.json";
import {log} from "../utilities/log";

config();

const app: Express = express();

app.use(express.json());
app.use(cors());
app.use((err, req: Request, res: Response, next) => {
    console.log(`Sending Error for ${req.route}`);
    res.status(err.status || 500);
    res.send(err);
});

app.use("/", (req: Request, res: Response, next) => {
    console.log(`Sending Response for ${req.path}?${req.query}`);
    next();
})

const respond = (res, data) => res.status(200).send(data);

app.get("/", (request: Request, response: Response) => {
    response.send("Hello World from the DND React Server!");
});

app.get("/listCount", async (request: Request, response: Response, next) => {
    try {
        const getJson = new jsonUtils("./json/listCount.json");
        const res = await getJson.read();
    
        console.log("Returning Response");
        console.log(request.query);
    
        respond(response, res);
    } catch (error) {
        next();
    }
})

app.get("/testJson", async (request: Request, response: Response) => {
    response.send(listCount)
});

const port = process.env.PORT || 8000;

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});