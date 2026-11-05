import type { ImageSource } from 'expo-image';

import type { ProjectCard } from '@/models/project';

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

export const MOCK_PROJECTS: MockProject[] = [
  {
    project: {
      id: 'birthday',
      title: 'День рождения Анны',
      eventStart: new Date(2026, 5, 14),
      eventEnd: null,
      coverUrl: null,
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
      coverUrl: null,
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
      coverUrl: null,
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
