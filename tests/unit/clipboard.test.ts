import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/src/utilities/clipboard";

describe("copyText", () => {
  afterEach(() => {
    delete window.json2ModelDesktop;
  });

  it("uses the isolated desktop clipboard bridge when packaged", async () => {
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    window.json2ModelDesktop = { writeClipboard };

    await copyText("class RootModel {}");

    expect(writeClipboard).toHaveBeenCalledOnce();
    expect(writeClipboard).toHaveBeenCalledWith("class RootModel {}");
  });
});
