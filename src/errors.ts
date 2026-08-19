/**
 * Error thrown when a Demiplane API request fails.
 * Contains the HTTP status code, the name of the operation that failed,
 * and the URL that was requested.
 */
export class DemiplaneApiError extends Error {
  readonly statusCode: number;
  readonly operationName: string;
  readonly requestUrl: string;

  /**
   * Creates a new DemiplaneApiError.
   * @param statusCode - The HTTP status code returned by the API (0 if the request failed to send).
   * @param operationName - A human-readable name for the operation that failed.
   * @param requestUrl - The URL that was requested.
   */
  constructor(statusCode: number, operationName: string, requestUrl: string) {
    super(`${operationName} failed with status ${statusCode}`);
    this.name = "DemiplaneApiError";
    this.statusCode = statusCode;
    this.operationName = operationName;
    this.requestUrl = requestUrl;
  }
}
