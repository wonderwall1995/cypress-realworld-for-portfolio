/// <reference types="react-scripts" />

// a file imported as plain text: import text from "./file.md?raw"
declare module "*?raw" {
  const content: string;
  export default content;
}
