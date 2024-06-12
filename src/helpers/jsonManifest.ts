/* Import Utilities */
import {anyObject} from "../.types";
import { AsyncUtil } from "../utilities/asyncUtil";
import { dateStamp } from "../utilities/dateStamp";
import { dBug } from "../utilities/dBug";
import { FsUtils } from "../utilities/fsUtils";
import { log, logLine } from "../utilities/log";
import { objectExtend } from "../utilities/objecExtend";
import { srcPath } from "../utilities/srcPath";
import { elapsed } from "../utilities/timeConversion";


const debManifest = new dBug("helpers:jsonManifest:fetchManifest");
const propsFile = srcPath("properties.i.json");

interface Iproperties {
    updated: string;
    pulled: string;
}

const defaultProps = {
    helpers: {
        manifest: {
            updated: "./manifest.i.json",
            pulled: "./manifest_pulled.i.json"
        }
    }
};

export const fetchManifest = (): Promise<anyObject> => {
    const properties: Iproperties = {
        updated: "",
        pulled: ""
    };
    let fsUpdated = new FsUtils(properties.updated);
    let fsPulled = new FsUtils(properties.pulled);

    const fetchProperties = () => {
        const deb = debManifest.set("fetchProperties");
        const fs = new FsUtils(propsFile);
        return fs.read.properties(defaultProps)
        .then((allProps) => {
            const props = allProps as {helpers: {manifest: anyObject;};};
            deb("Manifest Properties Received");
            deb(props);
            for (const key in props.helpers.manifest) {
                if (props.helpers.manifest.hasOwnProperty(key)) {
                    deb(`Setting Manifest Properties for ${key}`);
                    deb(props.helpers.manifest[key]);
                    properties[key] = props.helpers.manifest[key];
                }
            }
        })
        .then(() => {
            deb("Manifest Properties Updated");
            deb(properties);
        });
    };

    const mergeManifest = () => {
        const deb = debManifest.set("mergeManifest");


        let workingManifest = {};

        const fetchUpdated = () => {
            deb(`Checking for manifest at ${properties.updated}`);
            return fsUpdated.check()
            .then(() => {
                return fsUpdated.read.raw()
                .then((result)  => {
                    deb("Updated Manifest obtained");
                    deb(result);
                    const manifestData = JSON.parse(result.data);
                    
                    deb("Updated Manifest parsed");
                    deb(manifestData);
                    return Promise.resolve(manifestData);
                });
            })
            .catch(() => {
                deb("Updated Manifest Not Located");
                return Promise.resolve({});
            });
        };
        
        const fetchPulled = () => {
            deb(`Checking for manifest at ${properties.pulled}`);
            return fsPulled.check()
            .then(() => {
                return fsPulled.read.raw()
                .then((result)  => {
                    deb("Pulled Manifest obtained");
                    deb(result);
                    const manifestData = JSON.parse(result.data);
    
                    deb("Pulled Manifest parsed");
                    deb(manifestData);

                    return Promise.resolve(manifestData);
                });
            })
            .catch(() => {
                deb("Pulled Manifest Not Located");
                const emptyManfest = {};
                return Promise.resolve({});
            });
        };
        return fetchUpdated()
            .then((manifest) => {
                deb("Current manifest");
                deb(manifest);
                const currentManifest = manifest;
                
                return fetchPulled()
                .then((manifest) => {
                    deb("Pulled manifest");
                    deb(manifest);
                    workingManifest = objectExtend(currentManifest, manifest);

                    deb("Extended Manifest");
                    deb(workingManifest);

                    return Promise.resolve(workingManifest);
                });
            });
    };

    
    const updateManifest = (manifestData) => {
        const deb = debManifest.set("fetchManifest:updateManifest");
        return fsUpdated.create.json(manifestData)
        .then(() => {
            return Promise.resolve(manifestData);
        })
        .catch((err) => {
            deb("something went wrong");
            deb(err);
            return Promise.reject(err);
        });
    };
    const deb = debManifest.call();

    deb("BEGINNING MANIFEST FETCH");

    return fetchProperties()
        .then(() => {
            fsUpdated = new FsUtils(srcPath(properties.updated));
            fsPulled = new FsUtils(srcPath(properties.pulled));
            return Promise.resolve();
        })
        .then(mergeManifest)
        .then((manifest) => {
            deb("Manifest Merge Complete");
            deb(manifest);
            
            return updateManifest(manifest);
        });
};
