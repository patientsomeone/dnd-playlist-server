import {config} from "dotenv";
import {resolve} from "node:path";
import {projectRoot} from "./projectRoot";

// Host-provided values win. Local .i.env takes precedence over the optional .env.
config({path: [resolve(projectRoot, ".i.env"), resolve(projectRoot, ".env")], quiet: true});
