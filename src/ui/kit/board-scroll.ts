import { createContext, useContext } from 'react';

export type BoardScroll = {
  scrollBy: (delta: number) => void;
};

export const BoardScrollContext = createContext<BoardScroll | null>(null);

export function useBoardScroll(): BoardScroll | null {
  return useContext(BoardScrollContext);
}
