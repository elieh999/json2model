export {};

declare global {
  interface Window {
    json2ModelDesktop?: {
      writeClipboard(text: string): Promise<void>;
    };
  }
}
