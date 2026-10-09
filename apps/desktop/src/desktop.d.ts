export {};
declare global {
  interface Window {
    desktop?: {
      openPdf: (data: Uint8Array) => Promise<void>;
      saveFile: (data: Uint8Array, name: string) => Promise<boolean>;
    };
  }
}
