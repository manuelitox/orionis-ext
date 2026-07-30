export type JobSource =
  | "linkedIn"
  | "wellfound"
  | "bigRemoteJob"
  | "notYetUnicorns"
  | "ashby";

export interface CapturedJob {
  source: JobSource;
  captured_at: string;
  title: string;
  company: string;
  website: string;
  salary: string;
  description: string;
  url: string;
}

export interface ExtractJobMessage {
  type: "ORIONIS_EXTRACT_JOB";
}

export type ExtractJobResponse =
  | {
      ok: true;
      job: CapturedJob;
    }
  | {
      ok: false;
      error: string;
    };
