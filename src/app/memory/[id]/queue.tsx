import UploadScreen from '@/app/memory/[id]/upload';

/**
 * `UploadQueue` (spec 8) — «Добавить кадры» while the sending is going: how it goes and every file
 * that did not go, over the same roll to add more from. A route of its own so that «Разобрать» on
 * «Мои кадры» has somewhere to lead, and so that «Добавить кадры» itself is the picking alone; the
 * screen is the picking one's, in its queue face.
 */
export default function UploadQueue() {
  return <UploadScreen queue />;
}
