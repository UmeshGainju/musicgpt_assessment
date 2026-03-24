import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: {
    user: { findMany: jest.Mock };
    audio: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn() },
      audio: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should return empty results when no matches', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.audio.findMany.mockResolvedValue([]);

    const result = await service.search(
      'nonexistent',
      undefined,
      undefined,
      10,
    );

    expect(result.users.data).toHaveLength(0);
    expect(result.audio.data).toHaveLength(0);
    expect(result.users.meta.next_cursor).toBeNull();
    expect(result.audio.meta.next_cursor).toBeNull();
  });

  it('should return scored results sorted by relevance', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'john@example.com',
        display_name: 'john',
        subscription_status: 'FREE',
        created_at: new Date(),
      },
      {
        id: 'u2',
        email: 'johndoe@example.com',
        display_name: 'Johnny',
        subscription_status: 'FREE',
        created_at: new Date(),
      },
      {
        id: 'u3',
        email: 'test@example.com',
        display_name: 'Not John Doe',
        subscription_status: 'PAID',
        created_at: new Date(),
      },
    ]);
    prisma.audio.findMany.mockResolvedValue([]);

    const result = await service.search('john', undefined, undefined, 10);

    expect(result.users.data.length).toBe(3);
    // Exact match ("john" display_name) gets score 100
    expect((result.users.data[0] as any)._score).toBe(100);
    // "johndoe@example.com" starts with "john" → 50, "Johnny" starts with "john" → 50
    expect((result.users.data[1] as any)._score).toBe(50);
    // "Not John Doe" contains "john" → 10
    expect((result.users.data[2] as any)._score).toBe(10);
  });

  it('should search audio by title', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.audio.findMany.mockResolvedValue([
      {
        id: 'a1',
        prompt_id: 'p1',
        user_id: 'u1',
        title: 'Rock Anthem',
        url: 'https://cdn.example.com/a1.mp3',
        created_at: new Date(),
      },
    ]);

    const result = await service.search('rock', undefined, undefined, 10);

    expect(result.audio.data).toHaveLength(1);
    expect((result.audio.data[0] as any).title).toBe('Rock Anthem');
  });

  it('should support cursor-based pagination', async () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      id: `u${i}`,
      email: `user${i}@test.com`,
      display_name: `testuser${i}`,
      subscription_status: 'FREE',
      created_at: new Date(),
    }));
    prisma.user.findMany.mockResolvedValue(users);
    prisma.audio.findMany.mockResolvedValue([]);

    // First page
    const page1 = await service.search('test', undefined, undefined, 2);
    expect(page1.users.data.length).toBe(2);

    // Should have a cursor if more results
    if (page1.users.meta.next_cursor) {
      prisma.user.findMany.mockResolvedValue(users);
      const page2 = await service.search(
        'test',
        page1.users.meta.next_cursor,
        undefined,
        2,
      );
      expect(page2.users.data.length).toBeGreaterThan(0);
    }
  });
});
