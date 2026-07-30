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
    const user = userEvent.setup();
    render(<ConverterApp />);
    const input = screen.getByLabelText("Paste JSON");

    fireEvent.change(input, { target: { value: '{"name": }' } });
    expect(await screen.findByText("Current input is invalid")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(/Invalid JSON/);

    await user.clear(input);
    fireEvent.change(input, { target: { value: '{"name":"Ada"}' } });
    await waitFor(() =>
      expect(screen.getByLabelText("Generated dart code")).toBeInTheDocument(),
    );
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

  it("formats, copies, and clears input", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    render(<ConverterApp />);
    const input = screen.getByLabelText("Paste JSON");

    fireEvent.change(input, { target: { value: '{"id":1,"name":"Ada"}' } });
    await user.click(screen.getByRole("button", { name: "Format" }));
    expect(input).toHaveValue('{\n  "id": 1,\n  "name": "Ada"\n}');

    const copyButtons = screen.getAllByRole("button", { name: "Copy" });
    await user.click(copyButtons[0]);
    expect(writeText).toHaveBeenCalledWith('{\n  "id": 1,\n  "name": "Ada"\n}');

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(input).toHaveValue("");
  });

  it("copies output and announces confirmation", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    render(<ConverterApp />);
    await user.click(screen.getByRole("button", { name: "Example" }));
    const copyButton = await screen.findByRole("button", { name: "Copy code" });
    await user.click(copyButton);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("class"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Generated code copied",
    );
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

  it("shows inference warnings for uncertain structures", async () => {
    render(<ConverterApp />);
    fireEvent.change(screen.getByLabelText("Paste JSON"), {
      target: { value: '{"items":[],"metadata":{}}' },
    });

    const warnings = await screen.findByText("2 inference warnings");
    expect(
      within(warnings.parentElement as HTMLElement).getByText(
        /array at \$\.items is empty/,
      ),
    ).toBeVisible();
  });
});
