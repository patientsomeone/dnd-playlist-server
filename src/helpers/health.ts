import { log, logLine } from "../utilities/log";

const health = (): {"status": "Okay";} => {
    return {
        status: "Okay"
    };
};
log(health());
export default health;
