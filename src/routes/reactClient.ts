import {Router, static as serveStatic, type ErrorRequestHandler} from "express";
import {join, resolve} from "node:path";

export function createReactClientRouter(directory: string): Router {
    const router = Router();
    const client = resolve(directory);
    const unavailable = "The playlist preview is temporarily unavailable.";

    router.use("/assets", serveStatic(join(client, "assets"), {
        index: false,
        redirect: false,
        dotfiles: "ignore",
        maxAge: 0
    }));
    router.get("/", (_request, response, next) => {
        response.set("Cache-Control", "no-store");
        response.sendFile(join(client, "index.html"), (error) => {
            if (!error) return;
            if (response.headersSent) return next(error);
            response.status(503).type("text").send(unavailable);
        });
    });
    // The client has no nested routes yet. Never substitute HTML for a missing asset.
    router.use((_request, response) => {
        response.set("Cache-Control", "no-store").status(404).type("text")
            .send("This is not the page you are looking for...");
    });
    const handleError: ErrorRequestHandler = (error: unknown, _request, response, next) => {
        if (response.headersSent) return next(error);
        response.set("Cache-Control", "no-store").status(503).type("text").send(unavailable);
    };
    router.use(handleError);
    return router;
}
