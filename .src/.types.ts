/* Sanitized Any */
export type anyStandard = (string | number | boolean | anyObject | void | anyArray | anyFunction);

/* Sanitized Function */
export type anyFunction = (arg?: anyStandard) => anyStandard;

/* Sanitized Object */
export type anyObject = {
    [key: string | number]: anyStandard;
};

export type anyArray = anyStandard[];