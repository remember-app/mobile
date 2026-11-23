export type SystemMediaItem = {
  name: string;
  mediaId: string;
  url: string;
  width: number | null;
  height: number | null;
};

export type SystemMediaResponse = { items: SystemMediaItem[] };
