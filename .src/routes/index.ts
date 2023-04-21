import {config} from "dotenv";
import express, {Express, Request, Response} from "express";
import path from "path";
import cors from "cors";

config();

const app: Express = express();

app.use(express.json());
app.use(cors());

app.get("/", (request: Request, response: Response) => {
    response.send("Hello World from the Typescript Server!@");
});

const port = process.env.PORT || 8000;

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});