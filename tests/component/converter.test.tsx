import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConverterApp } from "@/src/components/ConverterApp";
import { STORAGE_KEYS } from "@/src/hooks/useStoredPreferences";
import { MAX_INPUT_CHARACTERS } from "@/src/parser/jsonParser";

function jsonInput(): HTMLElement {
  return screen.getByLabelText("Paste JSON");
}

async function type(value: string): Promise<void> {
  fireEvent.change(jsonInput(), { target: { value } });
  await waitFor(() => {
    expect(jsonInput()).toHaveValue(value);
  });
}

describe("ConverterApp", () => {
  it("loads an example and switches between all generators", async () => {
    const user = userEvent.setup();
    render(<ConverterApp />);

    await user.click(screen.getByRole("button", { name: "Example" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Generated dart code")).toBeInTheDocument(),
    );
    expect(screen.getByText(/lines · \d+ models?/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /TypeScript/ }));
    await waitFor(() =>
      expect(
        screen.getByLabelText("Generated typescript code"),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /Python/ }));
    await waitFor(() =>
      expect(
        screen.getByLabelText("Generated python code"),
      ).toBeInTheDocument(),
    );
  });

  it("shows friendly invalid JSON feedback and recovers", async () => {
    render(<ConverterApp />);
    await type('{"name": }');

    expect(await screen.findByText("Current input is invalid")).toBeVisible();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Invalid JSON/);
    expect(alert).not.toHaveTextContent(/SyntaxError|is not valid JSON/);
    expect(jsonInput()).toHaveAttribute("aria-invalid", "true");

    await type('{"name":"Ada"}');
    await waitFor(() =>
      expect(screen.getByLabelText("Generated dart code")).toBeInTheDocument(),
    );
    expect(jsonInput()).toHaveAttribute("aria-invalid", "false");
  });

  it("explains an oversized document instead of crashing", async () => {
    render(<ConverterApp />);
    await type(`"${"a".repeat(MAX_INPUT_CHARACTERS)}"`);

    expect(await screen.findByText("Current input is invalid")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(/accepts up to/);
    // The interface must still be usable.
    expect(screen.getByRole("heading", { name: "JSON input" })).toBeVisible();
  });

  it("formats and minifies without failing on oversized input", async () => {
    const user = userEvent.setup();
    render(<ConverterApp />);

    await type('{"id":1,"name":"Ada"}');
    await user.click(screen.getByRole("button", { name: "Format" }));
    expect(jsonInput()).toHaveValue('{\n  "id": 1,\n  "name": "Ada"\n}');

    await user.click(screen.getByRole("button", { name: "Minify" }));
    expect(jsonInput()).toHaveValue('{"id":1,"name":"Ada"}');

    // Formatting an oversized document used to throw out of the click handler.
    await type(`"${"a".repeat(MAX_INPUT_CHARACTERS)}"`);
    await user.click(screen.getByRole("button", { name: "Format" }));
    expect(screen.getByRole("status")).toHaveTextContent(/accepts up to/);
  });

  it("reports a friendly message when the JSON is not valid to format", async () => {
    const user = userEvent.setup();
    render(<ConverterApp />);
    await type("{oops}");
    await user.click(screen.getByRole("button", { name: "Format" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Invalid JSON/);
  });

  it("changes the root model name through settings", async () => {
    const user = userEvent.setup();
    render(<ConverterApp />);

    await user.click(screen.getByRole("button", { name: "Example" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const rootName = screen.getByLabelText("Root model name");
    await user.clear(rootName);
    await user.type(rootName, "Api response");

    await waitFor(() =>
      expect(screen.getByLabelText("Generated dart code")).toHaveTextContent(
        "class ApiResponse",
      ),
    );
  });

  it("shows only the settings that apply to the selected language", async () => {
    const user = userEvent.setup();
    render(<ConverterApp />);
    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByLabelText("Include fromJson")).toBeInTheDocument();
    expect(screen.queryByLabelText("Use modern unions")).toBeNull();
    // Converting keys only affects TypeScript, so it is not offered for Dart.
    expect(screen.queryByLabelText("Convert keys to camelCase")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Python/ }));
    expect(screen.getByLabelText("Use modern unions")).toBeInTheDocument();
    expect(screen.queryByLabelText("Include fromJson")).toBeNull();

    await user.click(screen.getByRole("button", { name: /TypeScript/ }));
    expect(
      screen.getByLabelText("Convert keys to camelCase"),
    ).toBeInTheDocument();
  });

  it("regenerates when a language setting changes", async () => {
    const user = userEvent.setup();
    render(<ConverterApp />);
    await type('{"first-name":"Ada"}');
    await user.click(screen.getByRole("button", { name: /TypeScript/ }));
    await user.click(screen.getByRole("button", { name: "Settings" }));

    const output = () => screen.getByLabelText("Generated typescript code");
    await waitFor(() => expect(output()).toHaveTextContent('"first-name"'));

    await user.click(screen.getByLabelText("Convert keys to camelCase"));
    await waitFor(() => expect(output()).toHaveTextContent("firstName"));
  });

  it("copies the input and the output", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    render(<ConverterApp />);

    await type('{"id":1}');
    await user.click(screen.getByRole("button", { name: "Copy input" }));
    expect(writeText).toHaveBeenCalledWith('{"id":1}');
    expect(screen.getByRole("status")).toHaveTextContent("Input copied");

    const copyCode = await screen.findByRole("button", { name: "Copy code" });
    await user.click(copyCode);
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining("class RootModel"),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Generated code copied",
    );
  });

  it("explains a clipboard refusal instead of failing silently", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    render(<ConverterApp />);

    await type('{"id":1}');
    await user.click(screen.getByRole("button", { name: "Copy input" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /Clipboard permission was denied/,
      ),
    );
  });

  it("clears the input", async () => {
    const user = userEvent.setup();
    render(<ConverterApp />);
    await type('{"id":1}');
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(jsonInput()).toHaveValue("");
    expect(screen.getByText("Your model will appear here")).toBeVisible();
  });

  it("switches themes and persists harmless preferences without input", async () => {
    const user = userEvent.setup();
    render(<ConverterApp />);
    await user.click(screen.getByRole("button", { name: "Example" }));
    await user.click(screen.getByRole("button", { name: "Dark" }));

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
    await waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEYS.preferences)).toContain("dark"),
    );
    expect(localStorage.getItem(STORAGE_KEYS.input)).toBeNull();
  });

  it("stores the input only after the setting is enabled", async () => {
    const user = userEvent.setup();
    render(<ConverterApp />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await type('{"secret":true}');
    expect(localStorage.getItem(STORAGE_KEYS.input)).toBeNull();

    await user.click(screen.getByLabelText("Remember input on this device"));
    await waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEYS.input)).toContain("secret"),
    );

    await user.click(screen.getByLabelText("Remember input on this device"));
    await waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEYS.input)).toBeNull(),
    );
  });

  it("shows inference warnings for uncertain structures", async () => {
    render(<ConverterApp />);
    await type('{"items":[],"metadata":{}}');

    const warnings = await screen.findByText("2 inference warnings");
    const list = within(warnings.parentElement as HTMLElement);
    expect(list.getByText(/array at \$\.items is empty/)).toBeVisible();
    expect(list.getByText(/object at \$\.metadata is empty/)).toBeVisible();
  });

  it("summarizes how many places produced the same warning", async () => {
    render(<ConverterApp />);
    const value = JSON.stringify(
      Array.from({ length: 40 }, () => ({ tags: [] })),
    );
    await type(value);

    const warnings = await screen.findByText("1 inference warning");
    expect(
      within(warnings.parentElement as HTMLElement).getByText(/40 places/),
    ).toBeVisible();
  });

  it("announces the output summary rather than the code itself", async () => {
    render(<ConverterApp />);
    await type('{"id":1}');
    await waitFor(() =>
      expect(screen.getByLabelText("Generated dart code")).toBeInTheDocument(),
    );

    // The live region is the short summary, so a screen reader is not read the
    // whole file on every keystroke.
    const summary = screen.getByText(/lines · 1 model/);
    expect(summary).toHaveAttribute("aria-live", "polite");
    expect(screen.getByLabelText("Generated dart code")).not.toHaveAttribute(
      "aria-live",
    );
  });

  it("keeps the download name free of path characters", async () => {
    const user = userEvent.setup();
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function mockClick(this: HTMLAnchorElement) {
        downloads.push(this.download);
      },
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    render(<ConverterApp />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const rootName = screen.getByLabelText("Root model name");
    await user.clear(rootName);
    await user.type(rootName, "../../etc/passwd");
    await type('{"id":1}');

    await user.click(await screen.findByRole("button", { name: "Download" }));
    // A root name cannot introduce a path separator or a leading dot.
    expect(downloads.at(-1)).toBe("EtcPasswd.dart");
  });

  it("leaves the interface working when the download fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("blocked");
    });

    render(<ConverterApp />);
    await type('{"id":1}');
    await user.click(await screen.findByRole("button", { name: "Download" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "The code file could not be downloaded.",
    );
    expect(screen.getByLabelText("Generated dart code")).toBeInTheDocument();
  });
});
