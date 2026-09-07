import { render, screen, waitFor } from "@testing-library/react";

import { ImageCropDialog } from "@/components/creator/image-crop-dialog";

/**
 * The frame/preview measurement effects need a ResizeObserver that actually
 * reports a size, or the preview stays gated behind `frameWidth > 0` forever.
 */
class MockResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe = (target: Element) => {
    this.callback(
      [{ target, contentRect: { width: 300, height: 300 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  };
  disconnect = jest.fn();
  unobserve = jest.fn();
}

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  decode = jest.fn().mockResolvedValue(undefined);
  private _src = "";
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this._src;
  }
}

function makeFile(name = "photo.jpg") {
  return new File(["fake-image-bytes"], name, { type: "image/jpeg" });
}

function mockCanvasDrawing() {
  const drawImage = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  return drawImage;
}

describe("ImageCropDialog", () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalImage = window.Image;

  beforeEach(() => {
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    URL.createObjectURL = jest.fn(() => "blob:mock-url");
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    globalThis.createImageBitmap = originalCreateImageBitmap;
    window.Image = originalImage;
    jest.restoreAllMocks();
  });

  it("previews from the decoded bitmap on a canvas, and enables Confirm, when createImageBitmap succeeds", async () => {
    const bitmapClose = jest.fn();
    globalThis.createImageBitmap = jest
      .fn()
      .mockResolvedValue({ width: 800, height: 600, close: bitmapClose }) as unknown as typeof createImageBitmap;
    mockCanvasDrawing();

    render(<ImageCropDialog file={makeFile()} onCancel={jest.fn()} onConfirm={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Use photo" })).not.toBeDisabled());

    expect(document.querySelector("canvas[aria-hidden='true']")).toBeInTheDocument();
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("falls back to the decoded <img> preview when createImageBitmap is unavailable", async () => {
    globalThis.createImageBitmap = undefined as unknown as typeof createImageBitmap;
    window.Image = MockImage as unknown as typeof Image;

    render(<ImageCropDialog file={makeFile()} onCancel={jest.fn()} onConfirm={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Use photo" })).not.toBeDisabled());

    expect(document.querySelector("canvas[aria-hidden='true']")).not.toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", "blob:mock-url");
  });

  it("releases the decoded bitmap on unmount", async () => {
    const bitmapClose = jest.fn();
    globalThis.createImageBitmap = jest
      .fn()
      .mockResolvedValue({ width: 800, height: 600, close: bitmapClose }) as unknown as typeof createImageBitmap;
    mockCanvasDrawing();

    const { unmount } = render(<ImageCropDialog file={makeFile()} onCancel={jest.fn()} onConfirm={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Use photo" })).not.toBeDisabled());

    unmount();

    expect(bitmapClose).toHaveBeenCalled();
  });
});
