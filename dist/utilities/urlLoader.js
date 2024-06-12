"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadUrl = void 0;
/* Import UTILITIES */
const dBug_1 = require("../utilities/dBug");
const axios_1 = __importDefault(require("axios"));
const axios_cookiejar_support_1 = require("axios-cookiejar-support");
const tough_cookie_1 = require("tough-cookie");
const dBugger = new dBug_1.dBug("utilities:urlLoader");
const testModule = true;
class LoadUrl {
    constructor(useToken) {
        this.initialized = false;
        this.useToken = false;
        this.getUrl = (config) => __awaiter(this, void 0, void 0, function* () {
            const deb = this.deb.append();
            deb.call(`Attempting to get data from ${config.url}`);
            try {
                const response = yield this.axios(config);
                deb.call("Retrieved data from URL");
                return response;
            }
            catch (err) {
                throw (err);
            }
        });
        this.deb = dBugger.append("LoadUrl");
        this.useToken = !!useToken;
        this.jar = new tough_cookie_1.CookieJar();
        const jar = this.jar;
        this.axios = (0, axios_cookiejar_support_1.wrapper)(axios_1.default.create({ jar }));
    }
}
_a = LoadUrl;
LoadUrl.single = (url) => __awaiter(void 0, void 0, void 0, function* () {
    const loader = new LoadUrl();
    const config = {
        url,
        method: "get"
    };
    try {
        return yield loader.getUrl(config);
    }
    catch (err) {
        console.error(err);
    }
});
exports.LoadUrl = LoadUrl;
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
//# sourceMappingURL=urlLoader.js.map