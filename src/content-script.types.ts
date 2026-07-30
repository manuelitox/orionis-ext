export type ExtractedJobFields = {
  title: string;
  company: string;
  website: string;
  salary: string;
  description: string;
};

export type CapturedJob = ExtractedJobFields & {
  source: string;
  captured_at: string;
  url: string;
};

export type JobSource = {
  source: string;
  urlPattern: RegExp;
  fields: Record<keyof ExtractedJobFields, () => string>;
  beforeExtract?: () => Promise<void>;
  validate?: (job: CapturedJob) => void;
};
