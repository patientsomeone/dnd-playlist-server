import React from "react";
import {Request} from "express";
import {renderToStaticMarkup} from "react-dom/server";
import {HelloWorld} from "./views/helloWorld";

export const reactResponse = async (jsxElement: (request: Request) => Promise<JSX.Element>, request: Request): Promise<string> => {
    const res = await jsxElement(request);

    return renderToStaticMarkup(res);
};