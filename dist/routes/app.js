"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const express_1 = __importDefault(require("express"));
// import path from "path";
const cors_1 = __importDefault(require("cors"));
const jsonUtils_1 = require("../utilities/jsonUtils");
const listCount_json_1 = __importDefault(require("../../json/listCount.json"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use((err, req, res, next) => {
    console.log(`Sending Error for ${req.route}`);
    res.status(err.status || 500);
    res.send(err);
});
app.use("/", (req, res, next) => {
    console.log(`Sending Response for ${req.path}?${req.query}`);
    next();
});
const respond = (res, data) => res.status(200).send(data);
app.get("/", (request, response) => {
    response.send("Hello World from the DND React Server!");
});
app.get("/listCount", (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const getJson = new jsonUtils_1.jsonUtils("./json/listCount.json");
        const res = yield getJson.read();
        console.log("Returning Response");
        console.log(request.query);
        respond(response, res);
    }
    catch (error) {
        next();
    }
}));
app.get("/testJson", (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    response.send(listCount_json_1.default);
}));
const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
//# sourceMappingURL=app.js.map