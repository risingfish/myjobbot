export interface Reply {
  status: number;
  body: string;
  headers?: Record<string, string>;
}
