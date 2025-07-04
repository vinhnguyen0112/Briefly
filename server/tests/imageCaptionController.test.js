const app = require("../app");
const imageCaptionService = require("../services/imageCaptionService");
const supertest = require("supertest");

// Mock service before importing app
jest.mock("../services/imageCaptionService", () => ({
  generateCaptions: jest.fn().mockImplementation((sources, content) => {
    return Promise.resolve({
      captions: sources.map(
        (_, index) => `Generated caption ${index + 1} for ${content}`
      ),
      usage: {
        prompt_tokens: 100 + sources.length * 10,
        completion_tokens: 50 + sources.length * 5,
        total_tokens: 150 + sources.length * 15,
      },
    });
  }),
}));

describe("POST /api/captionize", () => {
  const validImageSources = [
    "https://example.com/image1.jpg",
    "https://example.com/image2.png",
  ];
  const validContent = "Generate marketing captions for these product images";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test successful caption generation with valid data
   */
  it("Should successfully generate captions with valid data", async () => {
    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: validImageSources,
        content: validContent,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("captions");
        expect(response.body).toHaveProperty("usage");
        expect(Array.isArray(response.body.captions)).toBe(true);
        expect(response.body.captions).toHaveLength(2);
        expect(imageCaptionService.generateCaptions).toHaveBeenCalledWith(
          validImageSources,
          validContent
        );
      });
  });

  /**
   * Test caption generation with single image
   */
  it("Should successfully generate caption for single image", async () => {
    const singleSource = ["https://example.com/single-image.jpg"];

    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: singleSource,
        content: "Describe this product image",
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("captions");
        expect(response.body).toHaveProperty("usage");
        expect(response.body.captions).toHaveLength(1);
      });
  });

  /**
   * Test caption generation with multiple images
   */
  it("Should handle multiple images correctly", async () => {
    const multipleSources = [
      "https://example.com/image1.jpg",
      "https://example.com/image2.png",
      "https://example.com/image3.gif",
      "https://example.com/image4.webp",
    ];

    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: multipleSources,
        content: "Generate captions for these images",
      })
      .expect(200)
      .then((response) => {
        expect(response.body.captions).toHaveLength(4);
        expect(response.body.usage.total_tokens).toBeGreaterThan(150);
      });
  });

  /**
   * Test validation error when sources field is missing
   */
  it("Should fail if sources field is missing", async () => {
    await supertest(app)
      .post("/api/captionize")
      .send({ content: validContent })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty(
          "error",
          "sources must be a non-empty array"
        );
      });
  });

  /**
   * Test validation error when sources is not an array
   */
  it("Should fail if sources is not an array", async () => {
    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: "https://example.com/image.jpg",
        content: validContent,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty(
          "error",
          "sources must be a non-empty array"
        );
      });
  });

  /**
   * Test validation error when sources array is empty
   */
  it("Should fail if sources array is empty", async () => {
    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: [],
        content: validContent,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty(
          "error",
          "sources must be a non-empty array"
        );
      });
  });

  /**
   * Test validation error when content field is missing
   */
  it("Should fail if content field is missing", async () => {
    await supertest(app)
      .post("/api/captionize")
      .send({ sources: validImageSources })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty(
          "error",
          "Missing or invalid content context"
        );
      });
  });

  /**
   * Test validation error when content is not a string
   */
  it("Should fail if content is not a string", async () => {
    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: validImageSources,
        content: 123,
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty(
          "error",
          "Missing or invalid content context"
        );
      });
  });

  /**
   * Test validation error when content is empty string
   */
  it("Should fail if content is empty string", async () => {
    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: validImageSources,
        content: "",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty(
          "error",
          "Missing or invalid content context"
        );
      });
  });

  /**
   * Test validation error when content contains only whitespace
   */
  it("Should fail if content contains only whitespace", async () => {
    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: validImageSources,
        content: "   \t\n   ",
      })
      .expect(400)
      .then((response) => {
        expect(response.body).toHaveProperty(
          "error",
          "Missing or invalid content context"
        );
      });
  });

  /**
   * Test handling of service errors
   */
  it("Should handle service errors gracefully", async () => {
    imageCaptionService.generateCaptions.mockRejectedValueOnce(
      new Error("OpenAI API error")
    );

    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: validImageSources,
        content: validContent,
      })
      .expect(500)
      .then((response) => {
        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty("error");
      });
  });

  /**
   * Test with different content types
   */
  it("Should work with different content contexts", async () => {
    const testCases = [
      "Generate product descriptions",
      "Create social media captions",
      "Write alt text for accessibility",
      "Describe technical diagrams",
    ];

    for (const content of testCases) {
      await supertest(app)
        .post("/api/captionize")
        .send({
          sources: [validImageSources[0]],
          content,
        })
        .expect(200);
    }
  });

  /**
   * Test with various image URL formats
   */
  it("Should accept various image URL formats", async () => {
    const imageSources = [
      "https://example.com/image.jpg",
      "http://example.com/image.png",
      "https://cdn.example.com/path/to/image.gif",
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    ];

    await supertest(app)
      .post("/api/captionize")
      .send({
        sources: imageSources,
        content: "Describe these images",
      })
      .expect(200)
      .then((response) => {
        expect(response.body.captions).toHaveLength(4);
      });
  });
});
