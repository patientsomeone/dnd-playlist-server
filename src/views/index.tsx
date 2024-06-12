import React from "react";
import {Request} from "express";
import {renderToStaticMarkup} from "react-dom/server";
import {HelloWorld} from "./helloWorld";

export const reactResponse = async (jsxElement: (request: Request) => Promise<JSX.Element>, request: Request) => {
    const res = await jsxElement(request);

    return renderToStaticMarkup(res);
}