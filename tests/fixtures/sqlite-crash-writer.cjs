// A deliberately unfinished writer used only with a test-owned temporary database.
const sqlite3 = require("sqlite3");
const db = new sqlite3.Database(process.argv[2]);
db.configure("busyTimeout", 5000);
db.run("INSERT INTO refresh_leases(channel_id, token, expires_at) VALUES (?, ?, ?)",
    ["UC_one", "crash-fixture", Date.now() + Number(process.argv[3])], (error) => {
        if (error) throw error;
        db.exec(`BEGIN IMMEDIATE;
            UPDATE cache_channels SET last_update = 999 WHERE channel_id = 'UC_one';
            DELETE FROM cached_playlists WHERE channel_id = 'UC_one';`, (error) => {
            if (error) throw error;
            process.send("uncommitted");
            setInterval(() => {}, 1000);
        });
    });
