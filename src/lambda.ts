import serverlessExpress from "@codegenie/serverless-express";
import {app} from "./routes/app";

exports.handler = serverlessExpress({app});