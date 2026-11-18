import type { AnalysisJob } from '@/integrations/api';
import { i18n } from '@/ui/i18n';

/** Подпись статуса задачи анализа — одна на все экраны. */
export function analysisStatus(job: AnalysisJob): string {
  switch (job.status) {
    case 'running':
      return i18n.t('montage.analysisRunning');
    case 'queued':
      return i18n.t('montage.analysisWaiting');
    case 'failed':
      return i18n.t('montage.analysisFailedState');
    default:
      return i18n.t('montage.journal.noDescription');
  }
}
