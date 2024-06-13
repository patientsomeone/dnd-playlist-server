import React from "react";
import { Request } from "express";

export const HelloWorld = (request: Request): Promise<JSX.Element> => {
    console.log("Attempting to write to TSX");
    return Promise.resolve(
        <div>
            <h1> Hello World from the land of DND! </h1>
            <span>
                You arrived here from {request.path};
            </span>
        </div>
    );
};