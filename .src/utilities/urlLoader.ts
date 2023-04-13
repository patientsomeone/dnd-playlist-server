import * as async from "async";
import * as parseCsv from "csv-parse";
import * as debug from "debug";
import * as fs from "fs";
import * as performance from "performance";
import { CoreOptions, get, Headers } from "request";
import { dBug } from "./dBug";
import { Secrets } from "./fetchSecrets";
import { srcPath } from "./srcPath";
import { UrlConstructor } from "./urlConstructor";

import {log, logLine} from "./log";

const deUrl = debug("url:get");

    /*-- Define input file --*/
const input = srcPath("./input.csv");
    /*-- Define output file --*/
const output = srcPath("./output.csv");
    /*-- Define Column to check against --*/
const urlColumn = 4;
    /*-- Define callback --*/
const eachCallback = (response) => {
    log(response);
};

/*-- TODO: Write CSV Baseline processor --*/
export class LoadUrl {
    public static single(url: string): Promise<{error, response, body}> {
        const loader = new LoadUrl(false);
        return loader.get(url);
    }

    private deb = new dBug("utilities:urlLoader:LoadUrl");

    private useToken: boolean = false;

    private header = {
        reconstruct: (headerObject: { [key: string]: string }) => {
            const headersArray = [];
            for (const key in headerObject) {
                if (headerObject.hasOwnProperty(key)) {
                    headersArray.push(`${key}=${headerObject[key]}`);
                }
            }

            return Promise.resolve(headersArray);
        },

        check: (header: Headers) => {
            const debug = this.deb.set("cookie:checkHeader");
            // const headersObject: Headers = {};

            debug("Generating Headers Object");

            // header.map((data) => {
            //     debug(`Deconstructing Key: ${data.name}`);
            //     headersObject[data.name] = data.value;
            // });

            // for (const key in header) {
            //     headersObject[key] = header[key];
            // }

            debug("----- Header Object ------");
            debug(header);

            if (header.hasOwnProperty("Cookie")) {
                return this.cookie.deconstruct(header.Cookie)
                    .then((reconstructedCookie) => {
                        header.Cookie = reconstructedCookie;
                        return Promise.resolve(header);
                    })
                    .then(this.header.reconstruct);
            } else {
                header.Cookie = this.cookie.token;
                return this.header.reconstruct(header);
            }
        }
    };

    private secrets: string = void 0;

    private cookie = {
        token: void 0,
        reconstruct: (deconstructedCookies: {[key: string]: string}) => {
            const debug = this.deb.set("cookie:reconstruct");
            const reconstructedCookie = [];

            debug("Reconstructing Cookies");
            for (const key in deconstructedCookies) {
                if (deconstructedCookies.hasOwnProperty(key)) {
                    debug(`Reconstructing ${key}`);
                    reconstructedCookie.push(`${key}=${deconstructedCookies[key]}`);
                }
            }

            return Promise.resolve(reconstructedCookie.join("; "));
        },
        deconstruct: (cookie: string) => {
            const debug = this.deb.set("cookie:deconstruct");
            const objectifiedCookie: {[key: string]: string} = {};

            debug ("Processing Cookies");
            const cookieProcessing = cookie.split("; ").map((current) => {
                const debug = this.deb.set("cookie:deconstruct:map");
                const keyVal = current.split("=");
                debug(`Processing Cookie: ${keyVal[0]}`);
                objectifiedCookie[keyVal[0]] = keyVal[1];
            });

            if (objectifiedCookie.hasOwnProperty("Cookie")) {
                objectifiedCookie.Cookie += this.cookie.token;
                debug(`Added Token to existing Objectified Cookie ${objectifiedCookie.Cookie}`);
            } else {
                objectifiedCookie.Cookie = this.cookie.token;
                debug(`Added fresh Token to Objectified Cookie ${objectifiedCookie.Cookie}`);
            }

            return this.cookie.reconstruct(objectifiedCookie);
        },

        
        check: (options: CoreOptions): Promise<CoreOptions> => {
            const debug = this.deb.set("cookie:check");
            const hasHeaders = options.hasOwnProperty("headers");

            if (hasHeaders) {
                debug("Merging Token Cookie with existing");
                return this.header.check(options.headers)
                    .then((newOptions) => {
                        // options.headers = { Name: "Cookie", Value: newCookie };
                        return Promise.resolve(options);
                    });
            } else {
                debug("Creating Token Cookie from Scratch");
                options.headers = {Cookie: this.cookie.token};
                return Promise.resolve(options);
            }
        },
        set: () => {
            const debug = this.deb.set("cookie:set");
            const defaultCookie = "---- INSERT TOKEN HERE ----";
            
            const secrets = new Secrets({tokenCookie: defaultCookie});
            
            return secrets.fetch()
                .then((secretData) => {
                    if (secretData.tokenCookie === defaultCookie) {
                        logLine("Incorrect or missing token. Please add your token to the created secrets.i.json file");
                        debug(secretData);
                        return Promise.reject("Invalid Access Token");
                    } else {
                        this.cookie.token = secretData.tokenCookie;
                        return Promise.resolve();
                    }
                });
        },
        get: (options: CoreOptions) => {
            const debug = this.deb.set("cookie:get");
            if (!this.cookie.token) {
                return this.cookie.set()
                    .then(() => {
                        return this.cookie.check(options);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            } else {
                return this.cookie.check(options);
            }
        },
        isNeeded: (options: CoreOptions) => {
            const setOptions = options || {};

            if (this.useToken) {
                return this.cookie.get(setOptions)
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            } else {
                return Promise.resolve(options);
            }
        }
    };

    constructor(useToken?: boolean) {
        if (!!useToken) {
            this.useToken = true;
        }
    }

    // TODO: Add method for GET with Cookie from Properties

    
    public get = async (url: string, options?: CoreOptions) => {
        const deb = this.deb.set("get");
        // const newOptions = this.generateOptions(url, options);

        try {
            const response = await this.getUrl(url, options);
            deb(`Response Received:`);
            deb(response);
            return response;
        } catch (error) {
            deb(`Failed to receive response:`);
            deb(error);
            return {
                error,
                response: void 0,
                body: void 0
            };
        }
    }

    private getUrl = async (url, options?: CoreOptions) => {
        const deb = this.deb.set("getUrl");
        deb(`URL Promise beginning |  ${url}`);
        const theseOptions = await this.cookie.isNeeded(options);
        const data = {
            error: void 0,
            response: void 0,
            body: void 0,
        };

        return new Promise((urlResolve, urlReject) => {
            deb(`URL Promise beginning |  ${url}`);

            // TODO Troubleshoot and remove as any
            get(url, theseOptions, (error, response, body) => {
                data.error = error;
                data.response = response;
                data.body = body;

                deb(`Loading URL ${url}`);
                if (!!error) {
                    deb("ERROR ENCOUNTERED");
                    deb(data);

                    return urlReject(data);
                } else {
                    if (!body) {
                        deb("EMPTY RESPONSE");
                        deb(data);

                        return urlReject(data);
                    } else {
                        deb("RESPONSE RECEIVED");
                        deb(data);

                        return urlResolve(data);
                    }
                }
            });
        }) as Promise <typeof data>;
    }

    // private checkOptions = (options: CoreOptions) => {
    //     const debug = this.deb.set("checkOptions");
    //     debug(`Generating Options for URL`);
        
    //     return this.cookie.get(options);
    // }


    // private generateOptions = (options?: CoreOptions) => {
    //     const debug = this.deb.set("generateOptions");
    //     debug(`Generating Options for URL`);
    //     if (!options) {
    //         debug(`No Options Provided: Generating Fresh Options`);
    //         return this.cookie.isNeeded();
    //     } else {
    //         debug(`Options Provided: Checking Options`);
    //         return this.checkOptions(options);
    //     }
    // }
}

const testSingle = () => {
    logLine(" Testing Single URL ");
    return LoadUrl.single("https://media-cf.assets-cdk.com/teams/repository/export/e39/f15e0949c100588110050568b5709/e39f15e0949c100588110050568b5709.js")
        .then((response) => {
            log(`Body Received: ${!!response.body}`);
        });
};

const testGet = (toTest: "oos"|"partners") => {
    logLine("Testing Get Specific URL");

    const construct = new UrlConstructor("dit");
    const loader = new LoadUrl(true);
    const partnerDataUrl = construct.getSpecific({ partnerPortal: ["partners"] }).partnerPortal.partners;
    const oosDataUrl = construct.getSpecific({ oos: ["orders"] }).oos.orders;

    if (toTest === "oos") {
        loader.get(oosDataUrl)
            .then(() => {
                log(`Partner Data URL Defined ${oosDataUrl}`);
            });
    }

    
    if (toTest === "partners") {
        loader.get(partnerDataUrl)
            .then(() => {
                log(`Partner Data URL Defined ${oosDataUrl}`);
            });
    }
};

// testSingle();
// testGet("oos");


// const request = require('request');

// const options = {
//     method: 'GET',
//     url: 'https://api-dit.sincrotools.com/partner-portal-api/api/v1/partners',
//     headers: {
//         Cookie: 'ID_TOKEN=eyJraWQiOiJ3bHQ1LUI0b3dPbDhBUS1HY1ZRMGZTZ2pwdlJRNUxWdXdBV3NRTlI1SGlRIiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULlg2TXhHTTRiZzhPYU9MZnpVNzluVHdlV2ZuNnpVaF81U1hfdDA4WkJ2U0EiLCJpc3MiOiJodHRwczovL2xvZ2luLWRpdC5zaW5jcm90b29scy5jb20vb2F1dGgyL2RlZmF1bHQiLCJhdWQiOiJhcGk6Ly9kZWZhdWx0IiwiaWF0IjoxNjMxMjk5MzU3LCJleHAiOjE2MzEzMjgxNTcsImNpZCI6IjBvYWFtNGQ1V01NcmpmejRFMWQ1IiwidWlkIjoiMDB1ODR3aGc0NDJpbHBreTgxZDYiLCJzY3AiOlsib3BlbmlkIl0sInNpbmNyb0lkIjoiSm9zaHVhLlJvYmluc29uQHNpbmNyb2RpZ2l0YWwuY29tIiwic3ViIjoiSm9zaHVhLlJvYmluc29uQHNpbmNyb2RpZ2l0YWwuY29tIiwidXNlciI6Ikpvc2h1YS5Sb2JpbnNvbkBzaW5jcm9kaWdpdGFsLmNvbSJ9.F39QvwLhSt9BfO9wrW0sqTk1X8_mNvzA0-JrI_hHKXjkFRu8Y1TM2mrIvjQHtHQbqKnS2Cux5B1epv9gJjJGkPi4-gntOf7kzGa_V8TNcJBLtqIT-dCILD5U1YHjM58YcY7a2zXSar-pCIolkDtbZFFwa9QpqkbTCbn4UeDFBMW3kX8Miiohka5U3qZZYwTCch-VbXbSw7CplK_qrdwNEk8Cs-ohFwgfZ1exrrbqpshID_cwA4slArOqn4Ld_-zn9UPOrmVA49XB-Fx1en7mERefL2m58qpgop_jE6T4aVXy-Oj-QkM4OfRp0Ss2Iam3fFfFzw7rTiO5dofL3Avhcw; _bztag=ZWEwMTU2MmYzYTAyMTRiYTg0NzA4MjFjMTY5YWNkZGIyNThlMzYyNzk4MGM3NDZkZWZiZDUxMTI3NDkzZjAxOEAxNjMxMzAyMzc5MDQ5'
//     }
// };

// request(options, function (error, response, body) {
//     if (error) throw new Error(error);

//     console.log(body);
// });
