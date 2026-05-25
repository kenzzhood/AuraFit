export type QueueJobPayload = {
  jobId: string;
  userId: string;
  type: string;
  input: Record<string, unknown>;
  retryCount?: number;
};

export interface QueueProvider {
  readonly name: string;
  isConfigured(): boolean;
  enqueueGeneration(body: QueueJobPayload): Promise<boolean>;
}
