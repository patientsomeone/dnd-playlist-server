import {HelloWorld} from "../views/helloWorld";
import {dipsLists} from "../views/dipsList";
import {ReactLists} from "../views/reactLists";

// [x] Refactor to {[key: string]: {title: string, component: React.ComponentType}}
// export const reactRoutes = {
//     testReactRoutes: HelloWorld,
//     dipsLists,
//     ReactLists
// };

// [] Migrate to index.tsx
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