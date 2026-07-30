export async function copyText(value: string): Promise<void> {
  if (window.json2ModelDesktop?.writeClipboard) {
    await window.json2ModelDesktop.writeClipboard(value);
    return;
  }

  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is not available in this browser.");
  }
  await navigator.clipboard.writeText(value);
}
