import {dipsLists} from "./views/dipsList";
import {HelloWorld} from "./views/helloWorld";
import {ReactLists} from "./views/reactLists";

export const reactRoutes = {
    testReactRoutes: {
        title: "Test Page",
        component: HelloWorld
    },
    dipsLists: {
        title: "Dip's Lists",
        component: dipsLists
    },
    ReactLists: {
        title: "Patient's Playlist Organizer",
        component: ReactLists
    }
};

export const reactResponse = (title: string) => {
    return `
        <!DOCTYPE html>
            <html>
                <head>
                    <title> ${title} </title>
                </head>
                <body>
                    <div id="root"> </div>
                </body>
            </html>
    `
};