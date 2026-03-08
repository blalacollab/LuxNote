export interface EditorUploadAdapter {
  uploadFile: (
    file: File | string,
    options?: {
      id?: string;
      onProgress?: (fractionComplete: number) => void;
    }
  ) => Promise<string>;
}

