import {LoadUrl} from "./urlLoader";

const testUrl = "https://hydra-services.prod-cfp-pdx.sincrod.com/hydra-graph/route/base-graph/content/integrations?UID=bbaa20cf-532e-4b36-a3e0-9c6af84dc79b&configCtx={%22webId%22:%22gmps-lee-johnson%22,%22locale%22:%22en_US%22,%22version%22:%22LIVE%22,%22page%22:%22HomePage%22,%22secureSiteId%22:null}";

test("URL Title response should be 'Vendor | GubaGoo | Toolbar'", async () => {
    const response = await LoadUrl.single(testUrl);

    expect(response.data[0].title).toEqual("Vendor | GubaGoo | Toolbar");
});