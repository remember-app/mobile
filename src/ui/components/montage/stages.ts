import type { MontageStage } from '@/models';

export const stageLabel = (stage: MontageStage) => `montage.stage.${stage}` as const;

export const journalStageLabel = (stage: MontageStage) => `montage.journal.${stage}` as const;
