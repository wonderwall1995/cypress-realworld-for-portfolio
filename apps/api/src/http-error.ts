/** An error that carries the HTTP status the API should answer with (Express reads `status`). */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
