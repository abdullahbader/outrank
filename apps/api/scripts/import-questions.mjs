// Import a question dataset into the database. The engine never changes: it only sees question ids.
//
//   node scripts/import-questions.mjs [--file ../../content/test-questions.json]
//        [--categories ../../content/categories.json] [--replace] [--dry-run] [--test-db]
//
// --replace   questions of the same dataset that are not in the file are RETIRED (never deleted —
//             finished games still point at them). Use it when swapping the whole list.
// --dry-run   validate and report what would change, write nothing.
// --test-db   write to DATABASE_URL_TEST instead of DATABASE_URL.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const { validateDataset, readAnswer } = await import(pathToFileURL(join(root, 'content/validate.mjs')).href);

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d; };
const flag = (name) => args.includes(name);
const file = resolve(opt('--file', join(root, 'content/test-questions.json')));
const catFile = resolve(opt('--categories', join(root, 'content/categories.json')));

const envFile = join(root, '.env');
const env = !existsSync(envFile) ? {} : Object.fromEntries(readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const url = flag('--test-db') ? env.DATABASE_URL_TEST : (process.env.DATABASE_URL ?? env.DATABASE_URL);

const data = JSON.parse(readFileSync(file, 'utf8'));
const categories = JSON.parse(readFileSync(catFile, 'utf8'));
const { errors, warnings } = validateDataset(data, categories);
for (const w of warnings) console.log(`  ! ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`  ✖ ${e}`);
  console.log(`\n✖ Not imported: ${errors.length} problem(s).`);
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const dataset = data.dataset;

function rowFor(q) {
  return {
    categoryId: q.category,
    titleEn: q.title.en,
    titleAr: q.title.ar ?? null,
    difficulty: q.difficulty ?? 2,
    rankingBasisEn: q.rankingBasis?.en ?? null,
    rankingBasisAr: q.rankingBasis?.ar ?? null,
    explanationEn: q.explanation?.en ?? null,
    explanationAr: q.explanation?.ar ?? null,
    asOf: q.asOf ?? null,
    status: q.status ?? 'active',
    verification: q.verification ?? 'unverified',
    lastVerifiedAt: q.lastVerified ? new Date(q.lastVerified) : null,
    dataset,
  };
}
const answersFor = (q) => q.answers.map((raw, k) => {
  const a = readAnswer(raw);
  return { rank: k + 1, textEn: a.en, textAr: a.ar, aliases: a.aliases ?? [], valueNote: a.note };
});
const fingerprint = (row, answers) => JSON.stringify([row, answers]);

try {
  const existing = await prisma.question.findMany({ where: { id: { in: data.questions.map((q) => q.id) } }, include: { answers: { orderBy: { rank: 'asc' } } } });
  const byId = new Map(existing.map((q) => [q.id, q]));
  let created = 0, updated = 0, unchanged = 0;
  const plan = data.questions.map((q) => {
    const row = rowFor(q);
    const answers = answersFor(q);
    const old = byId.get(q.id);
    if (!old) { created++; return { q, row, answers, kind: 'create' }; }
    const oldRow = rowFor({ ...q, category: old.categoryId, title: { en: old.titleEn, ar: old.titleAr }, difficulty: old.difficulty, rankingBasis: { en: old.rankingBasisEn, ar: old.rankingBasisAr }, explanation: old.explanationEn ? { en: old.explanationEn, ar: old.explanationAr } : undefined, asOf: old.asOf, status: old.status, verification: old.verification, lastVerified: old.lastVerifiedAt?.toISOString() });
    oldRow.dataset = old.dataset;
    const oldAnswers = old.answers.map((a) => ({ rank: a.rank, textEn: a.textEn, textAr: a.textAr, aliases: a.aliases, valueNote: a.valueNote }));
    if (fingerprint(row, answers) === fingerprint(oldRow, oldAnswers)) { unchanged++; return { q, row, answers, kind: 'same' }; }
    updated++;
    return { q, row, answers, kind: 'update', version: old.version + 1 };
  });
  const keep = new Set(data.questions.map((q) => q.id));
  const toRetire = flag('--replace')
    ? (await prisma.question.findMany({ where: { dataset, status: { not: 'retired' } }, select: { id: true } })).map((q) => q.id).filter((id) => !keep.has(id))
    : [];

  console.log(`Dataset ${dataset} → ${flag('--test-db') ? 'TEST database' : 'database'}: ${created} new, ${updated} changed, ${unchanged} unchanged, ${toRetire.length} to retire.`);
  if (flag('--dry-run')) { console.log('Dry run: nothing written.'); process.exit(0); }

  await prisma.$transaction(async (tx) => {
    for (const c of categories) {
      await tx.category.upsert({
        where: { id: c.id },
        create: { id: c.id, nameEn: c.en, nameAr: c.ar, icon: c.icon ?? 'star', sort: c.sort ?? 0, active: c.active ?? true },
        update: { nameEn: c.en, nameAr: c.ar, icon: c.icon ?? 'star', sort: c.sort ?? 0, active: c.active ?? true },
      });
    }
    for (const p of plan) {
      if (p.kind === 'same') continue;
      if (p.kind === 'create') {
        await tx.question.create({ data: { id: p.q.id, ...p.row, answers: { create: p.answers }, sources: { create: p.q.sources.map((s) => ({ label: s.label, url: s.url ?? null, accessedAt: s.accessed ?? null })) } } });
      } else {
        await tx.questionAnswer.deleteMany({ where: { questionId: p.q.id } });
        await tx.questionSource.deleteMany({ where: { questionId: p.q.id } });
        await tx.question.update({ where: { id: p.q.id }, data: { ...p.row, version: p.version, answers: { create: p.answers }, sources: { create: p.q.sources.map((s) => ({ label: s.label, url: s.url ?? null, accessedAt: s.accessed ?? null })) } } });
      }
    }
    if (toRetire.length) await tx.question.updateMany({ where: { id: { in: toRetire } }, data: { status: 'retired' } });
  }, { timeout: 120_000 });
  const ready = await prisma.question.count({ where: { status: 'active', verification: 'verified' } });
  console.log(`✔ Imported. ${ready} questions are ready for games. Restart the API so it reloads question text.`);
} finally {
  await prisma.$disconnect();
}
