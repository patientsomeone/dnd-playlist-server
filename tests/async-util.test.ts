import {AsyncUtil} from "../src/utilities/asyncUtil";

jest.mock("../src/utilities/log", () => ({log: jest.fn(), logLine: jest.fn()}));

describe("typed asynchronous collection helpers", () => {
    test("visits typed dictionary values and completes without a result payload", async () => {
        const seen: string[] = [];
        await expect(AsyncUtil.eachOfSeries({first: 1, second: 2}, (value, key, next) => {
            seen.push(`${key}:${value.toFixed(0)}`);
            next();
        })).resolves.toBeUndefined();
        expect(seen).toEqual(["first:1", "second:2"]);
    });

    test("serial iteration rejects the original callback error and stops processing", async () => {
        const error = new Error("Fixture iteration failed");
        const visited: number[] = [];
        await expect(AsyncUtil.eachOfSeries([1, 2], (value, _key, next) => {
            visited.push(value);
            next(error);
        })).rejects.toBe(error);
        expect(visited).toEqual([1]);
    });

    test("limited iteration handles completion and callback errors", async () => {
        const visited: number[] = [];
        await expect(AsyncUtil.eachOfLimit([1, 2], 1, (value, _key, next) => {
            visited.push(value);
            next();
        })).resolves.toBeUndefined();
        expect(visited).toEqual([1, 2]);
        const error = new Error("Fixture concurrent iteration failed");
        await expect(AsyncUtil.eachOfLimit([1], 1, (_value, _key, next) => next(error))).rejects.toBe(error);
    });
});
