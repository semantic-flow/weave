export interface WeaveProgressEvent {
  designatorPath: string;
  completed: number;
  total: number;
  percent: number;
}

export type WeaveProgressHandler = (event: WeaveProgressEvent) => void;
