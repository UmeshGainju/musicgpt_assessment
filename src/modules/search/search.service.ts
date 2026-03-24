import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface ScoredItem<T> {
  item: T;
  score: number;
}

export interface SearchResult<T> {
  data: T[];
  meta: {
    next_cursor: string | null;
  };
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    query: string,
    usersCursor: string | undefined,
    audioCursor: string | undefined,
    limit: number,
  ): Promise<{
    users: SearchResult<Record<string, unknown>>;
    audio: SearchResult<Record<string, unknown>>;
  }> {
    const normalizedQuery = query.toLowerCase().trim();

    const [usersResult, audioResult] = await Promise.all([
      this.searchUsers(normalizedQuery, usersCursor, limit),
      this.searchAudio(normalizedQuery, audioCursor, limit),
    ]);

    return {
      users: usersResult,
      audio: audioResult,
    };
  }

  private async searchUsers(
    query: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<SearchResult<Record<string, unknown>>> {
    // Decode cursor: base64 of "score:id"
    let cursorScore: number | undefined;
    let cursorId: string | undefined;
    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const [scoreStr, ...idParts] = decoded.split(':');
      cursorScore = parseInt(scoreStr, 10);
      cursorId = idParts.join(':');
    }

    // Fetch users matching the query
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { display_name: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        display_name: true,
        subscription_status: true,
        created_at: true,
      },
      take: 200, // fetch a reasonable batch for scoring
    });

    // Score and sort
    const scored: ScoredItem<(typeof users)[0]>[] = users.map((user) => ({
      item: user,
      score: this.calculateUserScore(query, user.email, user.display_name),
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.id.localeCompare(b.item.id);
    });

    // Apply cursor-based filtering
    let filtered = scored;
    if (cursorScore !== undefined && cursorId) {
      const cursorIndex = filtered.findIndex(
        (s) => s.score === cursorScore && s.item.id === cursorId,
      );
      if (cursorIndex >= 0) {
        filtered = filtered.slice(cursorIndex + 1);
      } else {
        // Fallback: skip items with higher or equal score+id
        filtered = filtered.filter(
          (s) =>
            s.score < cursorScore! ||
            (s.score === cursorScore! && s.item.id > cursorId!),
        );
      }
    }

    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const nextCursor =
      hasMore && page.length > 0
        ? Buffer.from(
            `${page[page.length - 1].score}:${page[page.length - 1].item.id}`,
          ).toString('base64')
        : null;

    return {
      data: page.map((s) => ({
        ...s.item,
        _score: s.score,
      })),
      meta: { next_cursor: nextCursor },
    };
  }

  private async searchAudio(
    query: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<SearchResult<Record<string, unknown>>> {
    let cursorScore: number | undefined;
    let cursorId: string | undefined;
    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const [scoreStr, ...idParts] = decoded.split(':');
      cursorScore = parseInt(scoreStr, 10);
      cursorId = idParts.join(':');
    }

    const audios = await this.prisma.audio.findMany({
      where: {
        title: { contains: query, mode: 'insensitive' },
      },
      select: {
        id: true,
        prompt_id: true,
        user_id: true,
        title: true,
        url: true,
        created_at: true,
      },
      take: 200,
    });

    const scored: ScoredItem<(typeof audios)[0]>[] = audios.map((audio) => ({
      item: audio,
      score: this.calculateFieldScore(query, audio.title),
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.id.localeCompare(b.item.id);
    });

    let filtered = scored;
    if (cursorScore !== undefined && cursorId) {
      const cursorIndex = filtered.findIndex(
        (s) => s.score === cursorScore && s.item.id === cursorId,
      );
      if (cursorIndex >= 0) {
        filtered = filtered.slice(cursorIndex + 1);
      } else {
        filtered = filtered.filter(
          (s) =>
            s.score < cursorScore! ||
            (s.score === cursorScore! && s.item.id > cursorId!),
        );
      }
    }

    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const nextCursor =
      hasMore && page.length > 0
        ? Buffer.from(
            `${page[page.length - 1].score}:${page[page.length - 1].item.id}`,
          ).toString('base64')
        : null;

    return {
      data: page.map((s) => ({
        ...s.item,
        _score: s.score,
      })),
      meta: { next_cursor: nextCursor },
    };
  }

  /**
   * Scoring logic:
   * - Exact match (case-insensitive) → 100
   * - Starts with query → 50
   * - Contains query → 10
   *
   * For users, takes the max score across email and display_name.
   */
  private calculateUserScore(
    query: string,
    email: string,
    displayName: string,
  ): number {
    return Math.max(
      this.calculateFieldScore(query, email),
      this.calculateFieldScore(query, displayName),
    );
  }

  private calculateFieldScore(query: string, field: string): number {
    const normalizedField = field.toLowerCase();
    if (normalizedField === query) return 100;
    if (normalizedField.startsWith(query)) return 50;
    if (normalizedField.includes(query)) return 10;
    return 0;
  }
}
