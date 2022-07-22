/* UTILITIES */
import { dBug, debLine } from "../utilities/dBug";
import { FsUtils } from "../utilities/fsUtils";
import { log, logLine } from "../utilities/log";
import { objectExtend } from "../utilities/objecExtend";
import { srcPath } from "../utilities/srcPath";

const debg = new dBug("utilities:fetchProperties");

interface Iproperties {
    [key: string]: any;
}

export class Properties {
    private properties: Iproperties;

    private intendedProperties: Iproperties;
    
    constructor(intendedProperties: Iproperties) {
        this.properties = {};
        this.intendedProperties = intendedProperties;
    }
    
    public fetch = function() {
        const  fs = new FsUtils(srcPath("properties.i.json"));
        const debFetch = debg.set("Properties:fetch");

        debFetch("Fetching Properties");
        return fs.read.properties(this.intendedProperties)
            .then((props) => {
                debFetch("Properties Received");
                debFetch(props);
                
                this.properties = objectExtend(this.intendedProperties, props);

                debFetch("Properties Set");
                debFetch(this.properties);

                return Promise.resolve(this.properties);
        
                })
                .catch((err) => {
                    debFetch("Something went wrong");
                    debFetch(err);
                    return Promise.reject(err);
                });
    };
}

const test = () => {
    const testProps = new Properties({
        test: "tested",
        anotherTest: {
            successA: true,
            successB: true
        }
    });

    log(testProps.fetch);
};

// test();
