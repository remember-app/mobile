import type { MediaId, MontageId, ProjectId, TemplateId, UserId } from '@/types/id';

export type MontageStage = 'analysis' | 'preparation' | 'directing' | 'editing';

export type MontageStatus = 'queued' | 'processing' | 'done' | 'failed';

export type MontageSettings = {
  targetSeconds: number;
  prompt: string | null;
  dimensions: { width: number; height: number };
  musicIds: MediaId[];
};

export type MontageOrder = MontageSettings & {
  includeItemIds: string[];
  requiredItemIds: string[];
  templateId: string | null;
  name: string | null;
};

export type MontageManifest = {
  preparationConfig: MontageOrder | null;
  directingInput: { mergedMontageData: Record<string, unknown> } | null;
  editingParams: { commands: unknown[] } | null;
};

export type MontageJournalDirecting = {
  text: string;
  usedItemIds: string[];
};

export type MontageJournal = {
  directing: MontageJournalDirecting | null;
};

export type Montage = {
  id: MontageId;
  projectId: ProjectId;
  createdBy: UserId;
  status: MontageStatus;
  manifest: MontageManifest;
  journal: MontageJournal;
  createdAt: Date;
  error: string | null;
};

export type MontageTemplate = {
  id: TemplateId;
  name: string;
  settings: MontageSettings;
  referenceMediaId: MediaId | null;
};

export function montageStage(montage: Montage): MontageStage {
  if (montage.status === 'queued') return 'analysis';
  if (!montage.manifest.directingInput) return 'preparation';
  if (!montage.manifest.editingParams) return 'directing';
  return 'editing';
}

export function montageItemIds(montage: Montage): string[] {
  return montage.manifest.preparationConfig?.includeItemIds ?? [];
}
