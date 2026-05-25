export type ProviderFailure = {
  system: string;
  provider: string;
  message: string;
};

export type ProviderMeta = {
  degraded?: boolean;
  failures?: ProviderFailure[];
  providersUsed?: string[];
};

export type ProviderResult<T> = {
  value: T;
  meta: ProviderMeta;
};

export type ProviderAttempt<T> = {
  name: string;
  configured: () => boolean;
  run: () => Promise<T>;
};
