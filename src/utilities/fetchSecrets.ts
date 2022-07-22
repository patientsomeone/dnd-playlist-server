/* UTILITIES */
import { dBug, debLine } from "../utilities/dBug";
import { FsUtils } from "../utilities/fsUtils";
import { log, logLine } from "../utilities/log";
import { objectExtend } from "../utilities/objecExtend";
import { srcPath } from "../utilities/srcPath";

const debg = new dBug("utilities:fetchSecrets");

interface Isecrets {
    [key: string]: any;
}

export class Secrets {
    private secrets: Isecrets;

    private intendedSecrets: Isecrets;

    constructor(intendedSecrets: Isecrets) {
        this.secrets = {};
        this.intendedSecrets = intendedSecrets;
    }

    public fetch = () => {
        const fs = new FsUtils(srcPath("secrets.i.json"));
        const debFetch = debg.set("Secrets:fetch");

        debFetch("Fetching Secrets");
        return fs.read.properties(this.intendedSecrets)
            .then((props) => {
                debFetch("Secrets Received");
                debFetch(props);

                this.secrets = objectExtend(this.intendedSecrets, props);

                debFetch("Secrets Set");
                debFetch(this.secrets);

                return Promise.resolve(this.secrets);

            })
            .catch((err) => {
                debFetch("Something went wrong");
                debFetch(err);
                return Promise.reject(err);
            });
    }
}

const test = () => {
    const testProps = new Secrets({
        test: "tested",
        anotherTest: {
            successA: true,
            successB: true
        }
    });

    log(testProps.fetch());
};

// test();
