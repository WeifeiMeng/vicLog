export type WriteErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "SLUG_CONFLICT"
  | "VERSION_CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "GIT_ERROR"
  | "CONFIG_ERROR"
  | "INTERNAL_ERROR";

export class WriteError extends Error {
  constructor(
    public readonly code: WriteErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WriteError";
  }
}
