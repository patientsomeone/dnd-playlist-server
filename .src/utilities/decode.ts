/* Import MODULES */
import * as atob from "atob";
import * as btoa from "btoa";
import { dBug, debLine } from "../utilities/dBug";

const debCrypt = new dBug("agents:oosConnect");

export const decrypt = (value) => {
    // const debDecrypt = debCrypt.set("decrypt");
    // debDecrypt(`Decrypting value ${value}`);
    return atob(atob(value));
}

export const encrypt = (value) => {
    // const debEncrypt = debCrypt.set("encrypt");
    // debEncrypt(`Encrypting value ${value}`);
    return btoa(btoa(value));
}