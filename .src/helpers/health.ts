import { log, logLine } from "../utilities/log";

const health = () => {
    return {
        status: "Okay"
    };
};
log(health());
export default health;
