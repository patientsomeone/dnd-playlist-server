import {convert, elapsed} from "../src/utilities/timeConversion";

jest.mock("../src/utilities/log", () => ({log: jest.fn()}));

describe("typed duration conversion", () => {
    test("converts supported units and ignores omitted values", () => {
        expect(convert({day: 1, hour: 1, minute: 1, second: 1})).toBe(90061000);
        expect(convert({second: undefined})).toBe(0);
        expect(convert({})).toBe(0);
    });

    test("preserves the existing elapsed formats and exact-unit boundary", () => {
        expect(elapsed(0, 1500)).toBe("00:00:00:01:500");
        expect(elapsed(0, 1500, "med")).toBe("1s 500ms");
        expect(elapsed(0, 1500, "long")).toBe("1 second 500 milliseconds");
        expect(elapsed(0, 1000)).toBe("00:00:00:00:1000");
    });
});
