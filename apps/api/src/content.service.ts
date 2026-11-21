import { Injectable } from '@nestjs/common';
import type { QuestionContent } from '@outrank/shared';
import { PrismaService } from './prisma.service';

/** Reads question content. The engine only ever sees ids; text is joined here for the views. */
@Injectable()
export class ContentService {
  private cache = new Map<string, QuestionContent>();

  constructor(private readonly prisma: PrismaService) {}

  /** Questions that may be used in a game: active and verified. */
  async selectablePool(categories: string[]) {
    return this.prisma.question.findMany({
      where: { categoryId: { in: categories }, status: 'active', verification: 'verified' },
      select: { id: true, categoryId: true },
    });
  }

  async categoriesWithCounts() {
    const cats = await this.prisma.category.findMany({ where: { active: true }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] });
    const counts = await this.prisma.question.groupBy({
      by: ['categoryId'],
      where: { status: 'active', verification: 'verified' },
      _count: { _all: true },
    });
    const byId = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return cats.map((c) => ({ id: c.id, name: { en: c.nameEn, ar: c.nameAr }, icon: c.icon, ready: byId.get(c.id) ?? 0 }));
  }

  async load(ids: string[]): Promise<Record<string, QuestionContent>> {
    const missing = ids.filter((id) => !this.cache.has(id));
    if (missing.length) {
      const rows = await this.prisma.question.findMany({ where: { id: { in: missing } }, include: { answers: true } });
      for (const q of rows) {
        this.cache.set(q.id, {
          id: q.id,
          categoryId: q.categoryId,
          title: { en: q.titleEn, ar: q.titleAr ?? undefined },
          difficulty: q.difficulty,
          rankingBasis: q.rankingBasisEn ? { en: q.rankingBasisEn, ar: q.rankingBasisAr ?? undefined } : undefined,
          explanation: q.explanationEn ? { en: q.explanationEn, ar: q.explanationAr ?? undefined } : undefined,
          asOf: q.asOf ?? undefined,
          answers: q.answers
            .sort((a, b) => a.rank - b.rank)
            .map((a) => ({ rank: a.rank, text: { en: a.textEn, ar: a.textAr ?? undefined }, aliases: a.aliases, valueNote: a.valueNote ?? undefined })),
        });
      }
    }
    const out: Record<string, QuestionContent> = {};
    for (const id of ids) {
      const q = this.cache.get(id);
      if (q) out[id] = q;
    }
    return out;
  }

  /** After an import, content may have changed. */
  clearCache() { this.cache.clear(); }
}
