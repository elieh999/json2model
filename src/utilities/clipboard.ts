/**
 * Copies text to the clipboard.
 *
 * The async clipboard API needs a secure context and permission, neither of which
 * is guaranteed when the single file build is opened straight from disk. The older
 * selection based command is kept as a fallback for that case.
 */
export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Permission refused or an insecure context. Fall through.
    }
  }
  if (!copyBySelection(value)) {
    throw new Error("Clipboard access is not available in this browser.");
  }
}

function copyBySelection(value: string): boolean {
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  // Off screen rather than hidden, because a hidden element cannot be selected.
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.append(area);
  try {
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
