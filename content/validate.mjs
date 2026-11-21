// Question dataset validator. Pure Node, no packages.
// Usage: node content/validate.mjs [questions.json] [categories.json]
// Exits 1 and lists every problem when the file is not safe to import.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERIFICATION = new Set(['unverified', 'verified', 'disputed']);
const STATUS = new Set(['draft', 'active', 'retired']);

export const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Turn a file answer ([en, ar, aliases, note] or {en, ar, aliases, note}) into one shape. */
export function readAnswer(a) {
  if (Array.isArray(a)) return { en: a[0], ar: a[1] ?? null, aliases: a[2] ?? [], note: a[3] ?? null };
  return { en: a?.en, ar: a?.ar ?? null, aliases: a?.aliases ?? [], note: a?.note ?? null };
}

export function validateDataset(data, categories) {
  const errors = [];
  const warnings = [];
  const catIds = new Set(categories.map((c) => c.id));
  for (const c of categories) {
    if (!c.id || !/^[a-z0-9-]+$/.test(c.id)) errors.push(`category "${c.id}": id must be lowercase letters, digits or dashes`);
    if (!c.en || !c.ar) errors.push(`category "${c.id}": needs an English and an Arabic name`);
  }
  if (!data || !Array.isArray(data.questions)) return { errors: ['file has no "questions" list'], warnings, count: 0 };
  if (!data.dataset || !/^[A-Z0-9_-]+$/.test(data.dataset)) errors.push('"dataset" must be a short upper-case label, e.g. TEST or MAIN');

  const ids = new Set();
  data.questions.forEach((q, i) => {
    const where = `question ${i + 1} (${q?.id ?? 'no id'})`;
    if (!q?.id || !/^[a-z0-9-]{3,80}$/.test(q.id)) errors.push(`${where}: id must be 3–80 lowercase letters, digits or dashes`);
    if (ids.has(q.id)) errors.push(`${where}: duplicate id`);
    ids.add(q.id);
    if (!catIds.has(q.category)) errors.push(`${where}: unknown category "${q.category}"`);
    if (!q.title?.en) errors.push(`${where}: missing English title`);
    if (!q.title?.ar) warnings.push(`${where}: no Arabic title (English will be shown)`);
    if (!q.rankingBasis?.en) errors.push(`${where}: missing ranking basis (what is measured, and how)`);
    if (!Array.isArray(q.sources) || !q.sources.length || q.sources.some((s) => !s?.label)) errors.push(`${where}: needs at least one source with a label`);
    if (q.difficulty !== undefined && ![1, 2, 3].includes(q.difficulty)) errors.push(`${where}: difficulty must be 1, 2 or 3`);
    if (q.verification !== undefined && !VERIFICATION.has(q.verification)) errors.push(`${where}: verification must be unverified, verified or disputed`);
    if (q.status !== undefined && !STATUS.has(q.status)) errors.push(`${where}: status must be draft, active or retired`);
    if (q.verification === 'verified' && !q.lastVerified) errors.push(`${where}: verified questions need "lastVerified" (date)`);
    if (q.lastVerified && Number.isNaN(Date.parse(q.lastVerified))) errors.push(`${where}: lastVerified is not a date`);

    if (!Array.isArray(q.answers) || q.answers.length !== 12) {
      errors.push(`${where}: must have exactly 12 ranked answers (has ${Array.isArray(q.answers) ? q.answers.length : 0})`);
      return;
    }
    const seen = new Map(); // normalised text → rank
    q.answers.forEach((raw, k) => {
      const a = readAnswer(raw);
      const rank = k + 1;
      if (!a.en || typeof a.en !== 'string') { errors.push(`${where}: rank ${rank} has no English text`); return; }
      if (!a.ar) warnings.push(`${where}: rank ${rank} has no Arabic text`);
      if (!Array.isArray(a.aliases)) errors.push(`${where}: rank ${rank} aliases must be a list`);
      for (const name of [a.en, a.ar, ...(Array.isArray(a.aliases) ? a.aliases : [])].filter(Boolean)) {
        const key = norm(name);
        if (!key) continue;
        const other = seen.get(key);
        if (other !== undefined && other !== rank) errors.push(`${where}: "${name}" is used by rank ${other} and rank ${rank} — the host could not tell them apart`);
        seen.set(key, rank);
      }
    });
  });
  return { errors, warnings, count: data.questions.length };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const qFile = process.argv[2] ?? new URL('./test-questions.json', import.meta.url);
  const cFile = process.argv[3] ?? new URL('./categories.json', import.meta.url);
  const data = JSON.parse(readFileSync(qFile, 'utf8'));
  const cats = JSON.parse(readFileSync(cFile, 'utf8'));
  const { errors, warnings, count } = validateDataset(data, cats);
  for (const w of warnings) console.log(`  ! ${w}`);
  for (const e of errors) console.log(`  ✖ ${e}`);
  const per = {};
  for (const q of data.questions ?? []) per[q.category] = (per[q.category] ?? 0) + 1;
  console.log(`\n${count} questions in dataset ${data.dataset}: ${Object.entries(per).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(errors.length ? `✖ ${errors.length} problem(s) — fix them before importing` : '✔ ready to import');
  process.exit(errors.length ? 1 : 0);
}
