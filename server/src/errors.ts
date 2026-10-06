export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const forbidden = () => new HttpError(403, "You don't have permission to do that");
export const conflict = (msg: string) => new HttpError(409, msg);
