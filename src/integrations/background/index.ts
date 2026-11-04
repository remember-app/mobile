import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

export const UPLOADS_TASK = 'remember-uploads';

let defined = false;

export function defineUploadTask(run: () => Promise<void>): void {
  if (defined || TaskManager.isTaskDefined(UPLOADS_TASK)) {
    defined = true;
    return;
  }
  defined = true;
  TaskManager.defineTask(UPLOADS_TASK, async () => {
    try {
      await run();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerUploadTask(): Promise<boolean> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  await BackgroundTask.registerTaskAsync(UPLOADS_TASK, { minimumInterval: 15 });
  return true;
}

export async function unregisterUploadTask(): Promise<void> {
  await BackgroundTask.unregisterTaskAsync(UPLOADS_TASK).catch(() => undefined);
}
