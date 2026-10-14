export interface Reply {
  status: number;
  body: string | Buffer;
  headers?: Record<string, string>;
}
