import axios from "axios";
import {LoadUrl} from "../src/utilities/urlLoader";

const mockHttpClient = jest.fn();
jest.mock("../src/utilities/log", () => ({log: jest.fn(), err: jest.fn(), logLine: jest.fn()}));
jest.mock("axios", () => ({
    __esModule: true,
    default: {create: jest.fn(() => mockHttpClient)}
}));
jest.mock("axios-cookiejar-support", () => ({wrapper: (client: any) => client}));

const clientsCreatedOnImport = jest.mocked(axios.create).mock.calls.length;

describe("isolated HTTP utility", () => {
    beforeEach(() => mockHttpClient.mockReset());

    test("importing the module does not initialize a client or request the demo URL", () => {
        expect(clientsCreatedOnImport).toBe(0);
        expect(mockHttpClient).not.toHaveBeenCalled();
    });

    test("forwards request configuration and returns the HTTP response", async () => {
        const response = {status: 200, data: [{title: "Fixture title"}]};
        mockHttpClient.mockResolvedValue(response);
        const loader = new LoadUrl();
        const request = {url: "https://fixture.invalid/playlists", method: "get", timeout: 1000};

        await expect(loader.getUrl(request)).resolves.toBe(response);
        expect(mockHttpClient).toHaveBeenCalledWith(request);
        expect(axios.create).toHaveBeenCalledWith({jar: expect.any(Object)});
    });

    test("single uses a GET request through the same client", async () => {
        mockHttpClient.mockResolvedValue({status: 200, data: "fixture"});
        await expect(LoadUrl.single("https://fixture.invalid/list")).resolves.toMatchObject({data: "fixture"});
        expect(mockHttpClient).toHaveBeenCalledWith({url: "https://fixture.invalid/list", method: "get"});
    });

    test("getUrl propagates HTTP failures without making a real network request", async () => {
        const error = new Error("Fixture timeout");
        mockHttpClient.mockRejectedValue(error);
        await expect(new LoadUrl().getUrl({url: "https://fixture.invalid/timeout"})).rejects.toBe(error);
    });

    test("single propagates HTTP failures instead of returning undefined", async () => {
        const error = new Error("Fixture timeout");
        mockHttpClient.mockRejectedValue(error);
        await expect(LoadUrl.single("https://fixture.invalid/timeout")).rejects.toBe(error);
    });
});
