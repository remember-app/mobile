import type { ImageSource } from 'expo-image';

import type { ProjectCard } from '@/models/project';
import { seedOrganizer } from './members';
import { profileState } from './profile';

const ZERO = {
  tokens: { tokens: 0, spend: 0 },
  storage: { bytes: 0, spend: 0 },
};

const covers: ImageSource[] = [
  require('../../../assets/images/mock/birthday.jpg'),
  require('../../../assets/images/mock/sea.jpg'),
  require('../../../assets/images/mock/friends.jpg'),
];

export type MockProject = {
  project: ProjectCard;
  cover: ImageSource;
  people: string[];
};

let projects: MockProject[] = [
  {
    project: {
      id: 'birthday',
      title: 'День рождения Анны',
      eventStart: new Date(2026, 5, 14),
      eventEnd: null,
      consumables: ZERO,
      previewUrls: [],
      itemCount: 124,
      memberCount: 9,
      sharedCount: 6,
      myRole: 'admin',
      myContribution: 'more_coming',
    },
    cover: covers[0],
    people: ['Анна', 'Борис', 'Вера', 'Глеб'],
  },
  {
    project: {
      id: 'sea',
      title: 'Море, август',
      eventStart: new Date(2026, 7, 8),
      eventEnd: new Date(2026, 7, 15),
      consumables: ZERO,
      previewUrls: [],
      itemCount: 312,
      memberCount: 5,
      sharedCount: 5,
      myRole: 'contributor',
      myContribution: 'done',
    },
    cover: covers[1],
    people: ['Даша', 'Илья', 'Кира'],
  },
  {
    project: {
      id: 'office',
      title: 'Проводы Егора',
      eventStart: new Date(2026, 9, 2),
      eventEnd: null,
      consumables: ZERO,
      previewUrls: [],
      itemCount: 47,
      memberCount: 12,
      sharedCount: 3,
      myRole: 'contributor',
      myContribution: 'not_started',
    },
    cover: covers[2],
    people: ['Егор', 'Лена', 'Марк', 'Ника', 'Олег'],
  },
];

const listeners = new Set<() => void>();

export const projectsState = (): MockProject[] => projects;

export function subscribeProjects(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export type ProjectPatch = {
  title?: string;
  eventStart?: Date;
  eventEnd?: Date | null;
  cover?: ImageSource;
};

export function createMockProject(input: {
  title: string;
  eventStart: Date;
  eventEnd: Date | null;
  storageGb?: number;
}): string {
  const id = `project-${Date.now()}`;
  const storageBytes = Math.round((input.storageGb ?? 0) * 1024 ** 3);
  projects = [
    ...projects,
    {
      project: {
        id,
        title: input.title,
        eventStart: input.eventStart,
        eventEnd: input.eventEnd,
        consumables: {
          tokens: { tokens: 0, spend: 0 },
          storage: { bytes: storageBytes, spend: 0 },
        },
        previewUrls: [],
        itemCount: 0,
        memberCount: 1,
        sharedCount: 0,
        myRole: 'admin',
        myContribution: 'not_started',
      },
      cover: covers[0],
      people: [],
    },
  ];
  emit();
  const host = profileState();
  seedOrganizer(id, host.name, host.username);
  return id;
}

export function updateMockProject(id: string, patch: ProjectPatch): void {
  projects = projects.map((entry) => {
    if (entry.project.id !== id) return entry;
    return {
      ...entry,
      cover: patch.cover ?? entry.cover,
      project: {
        ...entry.project,
        title: patch.title ?? entry.project.title,
        eventStart: patch.eventStart ?? entry.project.eventStart,
        eventEnd: patch.eventEnd === undefined ? entry.project.eventEnd : patch.eventEnd,
      },
    };
  });
  emit();
}

export function deleteMockProject(id: string): void {
  projects = projects.filter((entry) => entry.project.id !== id);
  emit();
}

export function setMockProjectCount(count: number): void {
  const target = Math.max(0, Math.floor(count));
  if (target <= projects.length) {
    projects = projects.slice(0, target);
    emit();
    return;
  }
  const next = [...projects];
  const host = profileState();
  for (let index = next.length; index < target; index += 1) {
    const id = `project-dev-${index + 1}`;
    next.push({
      project: {
        id,
        title: `Воспоминание ${index + 1}`,
        eventStart: new Date(),
        eventEnd: null,
        consumables: ZERO,
        previewUrls: [],
        itemCount: 0,
        memberCount: 1,
        sharedCount: 0,
        myRole: 'admin',
        myContribution: 'not_started',
      },
      cover: covers[0],
      people: [],
    });
    seedOrganizer(id, host.name, host.username);
  }
  projects = next;
  emit();
}
