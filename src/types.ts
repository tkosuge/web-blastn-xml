export interface Job {
  id: string;
  status: string;
  error?: string;
  created_at: string;
}

export interface Query {
  id: number;
  job_id: string;
  iteration_num: number;
  query_id: string;
  query_def: string;
  query_len: number;
}

export interface HSP {
  id: number;
  hit_id: number;
  hsp_num: number;
  bit_score: number;
  evalue: number;
  query_from: number;
  query_to: number;
  hit_from: number;
  hit_to: number;
  identity: number;
  align_len: number;
  qseq: string;
  hseq: string;
  midline: string;
  is_plus: number;
}

export interface Hit {
  id: number;
  query_id: number;
  hit_num: number;
  hit_id: string;
  hit_def: string;
  hit_len: number;
  hsps: HSP[];
}

export interface QueryWithHits extends Query {
  hits: Hit[];
}
