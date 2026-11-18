import type { PageResponse } from './common';

export type LabelResponse = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  color: `#${string}`;
  itemsIds: string[];
};

export type LabelsPageResponse = PageResponse<LabelResponse>;
