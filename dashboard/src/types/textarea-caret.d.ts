declare module 'textarea-caret' {
  interface CaretCoordinates {
    top: number;
    left: number;
    height: number;
  }

  export function getCaretCoordinates(
    element: HTMLTextAreaElement | HTMLInputElement,
    position: number
  ): CaretCoordinates;
}