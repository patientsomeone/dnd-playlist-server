// Check real dependency interop against loopback fixtures after the production build.
const assert = require("node:assert/strict");
const {createServer} = require("node:http");
const {once} = require("node:events");
const {youtube} = require("@googleapis/youtube");
const {LoadUrl} = require("../dist/server/utilities/urlLoader.js");
const sqlite3 = require("sqlite3");

async function main() {
    const server = createServer((request, response) => {
        const url = new URL(request.url, "http://fixture.invalid");
        response.setHeader("Content-Type", "application/json");
        if (url.pathname === "/cookie") {
            response.setHeader("Set-Cookie", "session=fixture; Path=/; HttpOnly");
            response.end("{}");
        } else if (url.pathname === "/echo-cookie") {
            response.end(JSON.stringify({cookie: request.headers.cookie}));
        } else if (url.pathname === "/youtube/v3/playlists") {
            assert.equal(url.searchParams.get("key"), "fixture-key");
            assert.equal(url.searchParams.get("channelId"), "UC_fixture");
            response.end(JSON.stringify({items: [{id: "PL_fixture", snippet: {title: "Travel"}}]}));
        } else {
            response.statusCode = 503;
            response.end(JSON.stringify({error: {code: 503, message: "Fixture failure"}}));
        }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
        const client = new LoadUrl();
        await client.getUrl({url: `${origin}/cookie`, proxy: false, timeout: 5000});
        const response = await client.getUrl({url: `${origin}/echo-cookie`, proxy: false, timeout: 5000});
        assert.equal(response.data.cookie, "session=fixture");
        await assert.rejects(client.getUrl({url: `${origin}/failure`, proxy: false, timeout: 5000}),
            (error) => error.response?.status === 503);
        const service = youtube({version: "v3", auth: "fixture-key", rootUrl: `${origin}/`});
        const playlists = await service.playlists.list({channelId: "UC_fixture", part: ["snippet"]}, {timeout: 5000});
        assert.equal(playlists.data.items[0].id, "PL_fixture");
        await assert.rejects(service.playlistItems.list({playlistId: "PL_fixture", part: ["contentDetails"]},
            {timeout: 5000, retry: false}), (error) => error.response?.status === 503);
        const database = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(":memory:", (error) => error ? reject(error) : resolve(db));
        });
        try {
            const version = await new Promise((resolve, reject) => database.get("SELECT sqlite_version() AS version",
                (error, row) => error ? reject(error) : resolve(row.version)));
            assert.match(version, /^3\./);
            console.log(`Runtime interop passed: Axios cookies/errors, YouTube SDK requests/errors, SQLite ${version}.`);
        } finally {
            await new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
        }
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
