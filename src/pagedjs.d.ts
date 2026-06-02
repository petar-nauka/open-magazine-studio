declare module 'pagedjs' {
  export class Previewer {
    preview(content: string, stylesheets: string[], renderTo: HTMLElement): Promise<unknown>;
  }
}
