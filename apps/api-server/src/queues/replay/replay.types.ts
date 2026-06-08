export type ReplayJobData = {
  failureId: string;
  traceId?: string;
  targetBaseUrl?: string;
};

export type ReplayJobState =
  | "active"
  | "completed"
  | "delayed"
  | "failed"
  | "waiting";
