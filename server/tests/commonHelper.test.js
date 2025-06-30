const { ERROR_CODES } = require("../errors");
const commonHelper = require("../helpers/commonHelper");
const AppError = require("../models/appError");

describe("commonHelper", () => {
  describe("generateHash", () => {
    it("Should generate a SHA256 hash for given arguments", () => {
      const hash1 = commonHelper.generateHash("foo", "bar", 123);
      const hash2 = commonHelper.generateHash("foo", "bar", 123);
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe("string");
      expect(hash1.length).toBe(64);
    });

    it("Should ignore undefined and null arguments", () => {
      const hash1 = commonHelper.generateHash("foo", undefined, null, "bar");
      const hash2 = commonHelper.generateHash("foo", "bar");
      expect(hash1).toBe(hash2);
    });

    it("Should return different hashes for different inputs", () => {
      const hash1 = commonHelper.generateHash("foo", "bar");
      const hash2 = commonHelper.generateHash("bar", "foo");
      expect(hash1).not.toBe(hash2);
    });

    it("Should handle no arguments", () => {
      const hash = commonHelper.generateHash();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64);
    });
  });

  describe("generateName", () => {
    it("Should generate a unique user name with the correct prefix", () => {
      const name = commonHelper.generateName();
      expect(name.startsWith("Briefly_User_")).toBe(true);
      expect(name.length).toBeGreaterThan("Briefly_User_".length);
    });

    it("Should generate different names on subsequent calls", () => {
      const name1 = commonHelper.generateName();
      const name2 = commonHelper.generateName();
      expect(name1).not.toBe(name2);
    });
  });

  describe("processUrl", () => {
    it("Should normalize a URL and remove query parameters", () => {
      const url = "https://example.com/page?foo=bar&baz=qux";
      const normalized = commonHelper.processUrl(url);
      expect(normalized).toBe("https://example.com/page");
    });

    it("Should normalize URLs with or without trailing slashes", () => {
      const url1 = "https://example.com/page/";
      const url2 = "https://example.com/page";
      expect(commonHelper.processUrl(url1)).toBe(commonHelper.processUrl(url2));
    });

    it("Should throw if input is not a valid URL", () => {
      try {
        commonHelper.processUrl("not a url");
        fail("processUrl did not throw as expected");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe(ERROR_CODES.INVALID_INPUT);
      }
    });
  });
});
