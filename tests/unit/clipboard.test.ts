import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/src/utilities/clipboard";

describe("copyText", () => {
  afterEach(() => {
    delete window.json2ModelDesktop;
    vi.restoreAllMocks();
  });

  it("uses the isolated desktop clipboard bridge when packaged", async () => {
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    window.json2ModelDesktop = { writeClipboard };

    await copyText("class RootModel {}");

    expect(writeClipboard).toHaveBeenCalledOnce();
    expect(writeClipboard).toHaveBeenCalledWith("class RootModel {}");
  });

  it("uses the browser clipboard when there is no bridge", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    await copyText("export interface RootModel {}");

    expect(writeText).toHaveBeenCalledWith("export interface RootModel {}");
  });

  it("reports a clear error when no clipboard is available", async () => {
    const clipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    await expect(copyText("text")).rejects.toThrow(
      /Clipboard access is not available/,
    );

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboard,
    });
  });

  it("passes a rejection from the browser through to the caller", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("permission denied"),
    );
    await expect(copyText("text")).rejects.toThrow("permission denied");
  });
});
