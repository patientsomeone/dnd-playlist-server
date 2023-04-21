/* Import UTILITIES */
import {dBug, debLine} from "../utilities/dBug";
import {log, logLine} from "../utilities/log";
import {FsUtils} from "../utilities/fsUtils";
import {srcPath} from "../utilities/srcPath";
import {dateStamp} from "../utilities/dateStamp";
import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosResponseHeaders} from "axios";
import {wrapper} from "axios-cookiejar-support";
import {CookieJar} from "tough-cookie";
import {IDebugger} from "debug";

const dBugger = new dBug("utilities:urlLoader");
const testModule = true;

interface urlResponse {
    data: string;
    status: number;
    headers: AxiosResponseHeaders;
}

interface axiosJar extends AxiosRequestConfig {
    jar?: CookieJar;
}

export class LoadUrl {
    constructor(useToken?: boolean) {
        this.deb = dBugger.append("LoadUrl");
        this.useToken = !!useToken;

        this.jar = new CookieJar();
        const jar = this.jar;

        this.axios = wrapper(axios.create({jar}));
        
    }
    public static single = async (url: string): Promise<AxiosResponse> => {
        const loader = new LoadUrl();
        const config = {
            url,
            method: "get"
        };

        try {
            return await loader.getUrl(config);
        } catch (err) {
            console.error(err);
        };
    };
    private initialized = false;
    private axios: AxiosInstance;
    private jar: CookieJar;

    private deb: dBug;
    private useToken = false;

    public getUrl = async (config: axiosJar): Promise<AxiosResponse> => {
        const deb = this.deb.append();
        deb.call(`Attempting to get data from ${config.url}`);

        try {
            const response = await this.axios(config);
            deb.call("Retrieved data from URL");
            return response;
        } catch (err) {
            throw(err);
        };


    };
}

const test = () => {
    const deb = dBugger.set();
    deb("Initializing URL Loader Test");

    LoadUrl.single("https://hydra-services.prod-cfp-pdx.sincrod.com/hydra-graph/route/base-graph/content/integrations?UID=bbaa20cf-532e-4b36-a3e0-9c6af84dc79b&configCtx={%22webId%22:%22gmps-lee-johnson%22,%22locale%22:%22en_US%22,%22version%22:%22LIVE%22,%22page%22:%22HomePage%22,%22secureSiteId%22:null}")
        .then((data) => {
            deb("Response received from LoadUrl.single");
            deb(data.data[0].title);
        })
        .catch((err) => {
            deb("No response received from LoadUrl.single");
        });

    // LoadUrl.single("https://www.google.com")
    //     .then((data) => {
    //         deb("Response received from LoadUrl.single");
    //         deb(data.data);
    //     })
    //     .catch((err) => {
    //         deb("No response received from LoadUrl.single");
    //     });

};

if (testModule) {
    test();
}
