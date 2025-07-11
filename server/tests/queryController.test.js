const app = require("../app");
const { ERROR_CODES } = require("../errors");
const supertest = require("supertest");
const jestVariables = require("./jestVariables");
const { redisHelper } = require("../helpers/redisHelper");
const authHeader = `Bearer auth:${jestVariables.sessionId}`;

beforeAll(async () => {
  await redisHelper.client.connect();
});

afterAll(async () => {
  await redisHelper.client.quit();
});

describe("POST /api/query/captionize", () => {
  const validImageSources = [
    "https://example.com/image1.jpg",
    "https://example.com/image2.png",
  ];
  const validContent = "Generate marketing captions for these product images";

  it("Should successfully generate captions with valid data", async () => {
    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({
        sources: validImageSources,
        context: validContent,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
      });
  });

  it("Should successfully generate caption for single image", async () => {
    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({
        sources: [validImageSources[0]],
        context: "Describe this product image",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
      });
  });

  it("Should handle multiple image formats", async () => {
    const multipleSources = [
      "https://example.com/image1.jpg",
      "https://example.com/image2.png",
      "https://example.com/image3.gif",
      "https://example.com/image4.webp",
    ];

    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({
        sources: multipleSources,
        context: "Generate captions for these images",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
      });
  });

  it("Should fail if sources field is missing", async () => {
    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({ context: validContent })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if sources is not an array", async () => {
    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({
        sources: "https://example.com/image.jpg",
        context: validContent,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if sources array is empty", async () => {
    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({
        sources: [],
        context: validContent,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if context is missing", async () => {
    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({ sources: validImageSources })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if context is not a string", async () => {
    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({
        sources: validImageSources,
        context: 123,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if context is an empty string", async () => {
    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({
        sources: validImageSources,
        context: "",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should fail if context contains only whitespace", async () => {
    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({
        sources: validImageSources,
        context: "   \t\n   ",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_INPUT,
          },
        });
      });
  });

  it("Should accept various image URL formats", async () => {
    const imageSources = [
      "https://example.com/image.jpg",
      "http://example.com/image.png",
      "https://cdn.example.com/path/to/image.gif",
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    ];

    await supertest(app)
      .post("/api/query/captionize")
      .set("Authorization", authHeader)
      .send({
        sources: imageSources,
        context: "Describe these images",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
      });
  });
});
