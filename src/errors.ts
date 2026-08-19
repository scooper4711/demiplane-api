export class DemiplaneApiError extends Error {
  readonly statusCode: number;
  readonly operationName: string;
  readonly requestUrl: string;

  constructor(statusCode: number, operationName: string, requestUrl: string) {
    super(`${operationName} failed with status ${statusCode}`);
    this.name = "DemiplaneApiError";
    this.statusCode = statusCode;
    this.operationName = operationName;
    this.requestUrl = requestUrl;
  }
}
