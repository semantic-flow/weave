export class WeaveInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeaveInputError";
  }
}
