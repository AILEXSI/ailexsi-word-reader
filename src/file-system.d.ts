export {}

declare global {
  interface OpenFilePickerOptions {
    multiple?: boolean
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }

  interface FileSystemFileHandle {
    readonly kind: 'file'
    getFile(): Promise<File>
  }

  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>
  }
}
