import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/src/utilities/clipboard";

describe("copyText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the async clipboard when it is available", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    await copyText("export interface RootModel {}");

    expect(writeText).toHaveBeenCalledWith("export interface RootModel {}");
  });

  it("falls back to a selection copy when the clipboard is refused", async () => {
    // A page opened straight from disk can be denied the async clipboard.
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("permission denied"),
    );
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    await expect(copyText("class RootModel {}")).resolves.toBeUndefined();
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("removes the temporary element it used for the fallback", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });

    const before = document.body.childElementCount;
    await copyText("text");
    expect(document.body.childElementCount).toBe(before);
  });

  it("reports a clear error when nothing can copy", async () => {
    const clipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    await expect(copyText("text")).rejects.toThrow(
      /Clipboard access is not available/,
    );

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboard,
    });
  });
});
