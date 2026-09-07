import { EditableImageError, prepareEditableImage } from "@/lib/editable-image";

function jpegFile(type = "") {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], "camera-photo", {
    type,
    lastModified: 123,
  });
}

describe("prepareEditableImage", () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  let getContextSpy: jest.SpyInstance;
  let toBlobSpy: jest.SpyInstance;
  const close = jest.fn();
  const drawImage = jest.fn();

  beforeEach(() => {
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: jest.fn(async () => ({ width: 4000, height: 2000, close })),
    });
    getContextSpy = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: jest.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    toBlobSpy = jest.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["safe-jpeg"], { type: "image/jpeg" }));
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: originalCreateImageBitmap,
    });
    getContextSpy.mockRestore();
    toBlobSpy.mockRestore();
    close.mockClear();
    drawImage.mockClear();
  });

  it("recognizes an Android gallery photo with no MIME type and prepares a safe JPEG", async () => {
    const result = await prepareEditableImage(jpegFile());

    expect(result.name).toBe("camera-photo.jpg");
    expect(result.type).toBe("image/jpeg");
    expect(result.lastModified).toBe(123);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2400, 1200);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("uses the file contents when the gallery reports the wrong MIME type", async () => {
    const result = await prepareEditableImage(jpegFile("application/octet-stream"));

    expect(result.type).toBe("image/jpeg");
  });

  it("rejects non-image files before opening the crop dialog", async () => {
    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });

    await expect(prepareEditableImage(file)).rejects.toBeInstanceOf(EditableImageError);
  });
});
