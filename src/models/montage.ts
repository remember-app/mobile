import type {
  MediaId,
  MontageId,
  MovieId,
  ProjectId,
  ProjectItemId,
  TemplateId,
  UserId,
} from '@/types/id';

export type MontageStage = 'analysis' | 'preparation' | 'directing' | 'editing';

export type MontageStatus = 'queued' | 'processing' | 'done' | 'failed';

export type Montage = {
  id: MontageId;
  projectId: ProjectId;
  createdBy: UserId;
  status: MontageStatus;
  stage: MontageStage;
  createdAt: Date;
  error: string | null;
  itemIds: ProjectItemId[];
  movieId: MovieId | null;
};

export type MontageSettings = {
  targetSeconds: number;
  prompt: string | null;
  dimensions: { width: number; height: number };
  musicIds: MediaId[];
};

export type MontageTemplate = {
  id: TemplateId;
  name: string;
  settings: MontageSettings;
  referenceMediaId: MediaId | null;
};
