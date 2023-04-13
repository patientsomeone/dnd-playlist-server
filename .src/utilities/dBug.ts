import * as debug from "debug";

export const debLine = (title?: string) => {
    if (title) {
        return `~-~-~-~-~-~-~ ${title} ~-~-~-~-~-~-~`
    } else {
        return "~-~-~-~-~-~-~ ~-~-~-~-~-~-~ ~-~-~-~-~-~-~"
    }
}
export class dBug {
    private prefixedBugger;

    /** 
     * Generate debugger prefix
     *   RECOMMENDATION: Prefix as path
     *     folderName:fileName
     */
    constructor(prefix: string) {
        this.prefixedBugger = prefix;
    }

    /** 
     * Generate debugger with suffix
     *   RECOMMENDATION: suffix as method name
     *     {folderName:fileName:}methodName
     */
    public set = (suffix: string) => {
        return debug(`${this.prefixedBugger}:${suffix}`);
    }

    public call = () => {
        return debug(this.prefixedBugger);
    }
}

const test = () => {
    const test = new dBug("test").set("test");

    test("This is a test");
};

// test();
