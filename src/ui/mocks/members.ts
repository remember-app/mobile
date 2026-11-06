export type MockRole = 'admin' | 'contributor' | 'viewer';
export type MockContribution = 'not_started' | 'more_coming' | 'done' | 'nothing';

export type MockMember = {
  id: string;
  name: string;
  username: string;
  role: MockRole;
  contribution: MockContribution;
  files: number;
  gigabytes: number;
};

let data: Record<string, MockMember[]> = {
  birthday: [
    {
      id: 'b1',
      name: 'Анна Петрова',
      username: 'anna',
      role: 'admin',
      contribution: 'more_coming',
      files: 52,
      gigabytes: 2.4,
    },
    {
      id: 'b2',
      name: 'Борис Лебедев',
      username: 'boris',
      role: 'contributor',
      contribution: 'done',
      files: 31,
      gigabytes: 1.2,
    },
    {
      id: 'b3',
      name: 'Вера Соколова',
      username: 'vera',
      role: 'contributor',
      contribution: 'done',
      files: 18,
      gigabytes: 0.9,
    },
    {
      id: 'b4',
      name: 'Глеб Морозов',
      username: 'gleb',
      role: 'contributor',
      contribution: 'more_coming',
      files: 12,
      gigabytes: 0.6,
    },
    {
      id: 'b5',
      name: 'Даша Волкова',
      username: 'dasha',
      role: 'contributor',
      contribution: 'done',
      files: 6,
      gigabytes: 0.3,
    },
    {
      id: 'b6',
      name: 'Кира Орлова',
      username: 'kira',
      role: 'contributor',
      contribution: 'more_coming',
      files: 4,
      gigabytes: 0.2,
    },
    {
      id: 'b7',
      name: 'Илья Кузнецов',
      username: 'ilya',
      role: 'viewer',
      contribution: 'nothing',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'b8',
      name: 'Марк Зайцев',
      username: 'mark',
      role: 'viewer',
      contribution: 'nothing',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'b9',
      name: 'Олег Смирнов',
      username: 'oleg',
      role: 'contributor',
      contribution: 'not_started',
      files: 0,
      gigabytes: 0,
    },
  ],
  sea: [
    {
      id: 's1',
      name: 'Илья Кузнецов',
      username: 'ilya',
      role: 'admin',
      contribution: 'done',
      files: 120,
      gigabytes: 5.2,
    },
    {
      id: 's2',
      name: 'Даша Волкова',
      username: 'dasha',
      role: 'contributor',
      contribution: 'done',
      files: 86,
      gigabytes: 3.1,
    },
    {
      id: 's3',
      name: 'Кира Орлова',
      username: 'kira',
      role: 'contributor',
      contribution: 'done',
      files: 54,
      gigabytes: 2.2,
    },
    {
      id: 's4',
      name: 'Лена Крылова',
      username: 'lena',
      role: 'contributor',
      contribution: 'more_coming',
      files: 32,
      gigabytes: 1.4,
    },
    {
      id: 's5',
      name: 'Ника Белова',
      username: 'nika',
      role: 'contributor',
      contribution: 'done',
      files: 20,
      gigabytes: 0.9,
    },
  ],
  office: [
    {
      id: 'o1',
      name: 'Егор Соколов',
      username: 'egor',
      role: 'admin',
      contribution: 'more_coming',
      files: 20,
      gigabytes: 1,
    },
    {
      id: 'o2',
      name: 'Лена Крылова',
      username: 'lena',
      role: 'contributor',
      contribution: 'done',
      files: 15,
      gigabytes: 0.7,
    },
    {
      id: 'o3',
      name: 'Марк Зайцев',
      username: 'mark',
      role: 'contributor',
      contribution: 'done',
      files: 12,
      gigabytes: 0.5,
    },
    {
      id: 'o4',
      name: 'Ника Белова',
      username: 'nika',
      role: 'viewer',
      contribution: 'nothing',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'o5',
      name: 'Олег Смирнов',
      username: 'oleg',
      role: 'contributor',
      contribution: 'not_started',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'o6',
      name: 'Аня Лебедева',
      username: 'anya',
      role: 'contributor',
      contribution: 'not_started',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'o7',
      name: 'Борис Лебедев',
      username: 'boris',
      role: 'viewer',
      contribution: 'nothing',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'o8',
      name: 'Вера Соколова',
      username: 'vera',
      role: 'viewer',
      contribution: 'nothing',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'o9',
      name: 'Глеб Морозов',
      username: 'gleb',
      role: 'contributor',
      contribution: 'not_started',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'o10',
      name: 'Даша Волкова',
      username: 'dasha',
      role: 'contributor',
      contribution: 'not_started',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'o11',
      name: 'Кира Орлова',
      username: 'kira',
      role: 'viewer',
      contribution: 'nothing',
      files: 0,
      gigabytes: 0,
    },
    {
      id: 'o12',
      name: 'Илья Кузнецов',
      username: 'ilya',
      role: 'contributor',
      contribution: 'not_started',
      files: 0,
      gigabytes: 0,
    },
  ],
};

const listeners = new Set<() => void>();

export function membersOf(projectId: string): MockMember[] {
  return data[projectId] ?? [];
}

export function subscribeMembers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function addMember(projectId: string, username: string): void {
  const clean = username.trim().replace(/^@/, '');
  if (!clean) return;
  const list = data[projectId] ?? [];
  if (list.some((member) => member.username.toLowerCase() === clean.toLowerCase())) return;
  data = {
    ...data,
    [projectId]: [
      ...list,
      {
        id: `m-${projectId}-${clean}`,
        name: clean,
        username: clean,
        role: 'contributor',
        contribution: 'not_started',
        files: 0,
        gigabytes: 0,
      },
    ],
  };
  emit();
}
