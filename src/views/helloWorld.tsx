import React from "react";
import { Request } from "express";

export const HelloWorld = async (request: Request) => {
    console.log("Attempting to write to TSX");
    return (
        <div>
            <h1> Hello World from the land of DND! </h1>
            <span>
                You arrived here from {request.path};
            </span>
        </div>
    );
}; 