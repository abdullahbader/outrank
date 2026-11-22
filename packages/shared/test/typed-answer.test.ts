import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildView, normalizeAnswer, suggestRank, type QuestionContent } from '../src/views.ts';
import { HOST, P, content, newGame } from './helpers.ts';

test('the player on turn can type an answer; the host sees it with a suggested match', () => {
  const qs = content();
  const g = newGame(['A', 'B']);
  g.do(P('A'), { type: 'submit_answer', text: '  secret-1-7 ', turnSerial: g.serial });
  assert.equal(g.round.turn!.typed, 'secret-1-7');
  const host = buildView(g.state, qs, { role: 'host' });
  assert.equal(host.round!.suggestedRank, 7);
  const player = buildView(g.state, qs, { role: 'player', playerId: 'B' });
  assert.equal(player.round!.suggestedRank, null, 'players never get the suggestion (it would reveal a rank)');
  assert.equal(player.round!.turn!.typed, 'secret-1-7', 'everyone sees what was typed');
});

test('only the player on turn can type, and the text can be changed until the host rules', () => {
  const g = newGame(['A', 'B']);
  g.fail(P('B'), { type: 'submit_answer', text: 'x', turnSerial: g.serial }, 'NOT_YOUR_TURN');
  g.fail(HOST, { type: 'submit_answer', text: 'x', turnSerial: g.serial }, 'NOT_PLAYER');
  g.fail(P('A'), { type: 'submit_answer', text: '   ', turnSerial: g.serial }, 'ANSWER_INVALID');
  g.fail(P('A'), { type: 'submit_answer', text: 'y'.repeat(81), turnSerial: g.serial }, 'ANSWER_INVALID');
  g.do(P('A'), { type: 'submit_answer', text: 'first', turnSerial: g.serial });
  g.do(P('A'), { type: 'submit_answer', text: 'second', turnSerial: g.serial });
  assert.equal(g.round.turn!.typed, 'second');
  g.answer(3);
  assert.equal(g.round.turn!.typed ?? null, null, 'the next player starts with an empty box');
});

test('a Streak extra answer starts with an empty box', () => {
  const g = newGame(['A', 'B']);
  g.do(P('A'), { type: 'submit_answer', text: 'one', turnSerial: g.serial });
  g.confirm(4);
  g.fail(P('A'), { type: 'submit_answer', text: 'two', turnSerial: g.serial }, 'STALE_TURN');
  g.streak('A');
  assert.equal(g.round.turn!.typed, null);
  g.do(P('A'), { type: 'submit_answer', text: 'two', turnSerial: g.serial });
  assert.equal(g.round.turn!.typed, 'two');
});

test('matching is forgiving: case, accents, "the", aliases, Arabic letter forms', () => {
  const q: QuestionContent = {
    id: 'q', categoryId: 'geography', title: { en: 't' }, difficulty: 1,
    answers: [
      { rank: 1, text: { en: 'United States', ar: 'الولايات المتحدة' }, aliases: ['USA', 'America'] },
      { rank: 2, text: { en: 'São Paulo', ar: 'ساو باولو' } },
      { rank: 3, text: { en: 'The Moon', ar: 'القمر' } },
      { rank: 4, text: { en: 'Mississippi–Missouri', ar: 'ميسيسيبي' } },
    ],
  };
  assert.equal(suggestRank(q, 'usa'), 1);
  assert.equal(suggestRank(q, 'America!'), 1);
  assert.equal(suggestRank(q, 'الولايات المتحده'), 1);
  assert.equal(suggestRank(q, 'sao paulo'), 2);
  assert.equal(suggestRank(q, 'moon'), 3);
  assert.equal(suggestRank(q, 'قمر'), 3, 'Arabic without the leading ال still matches');
  assert.equal(suggestRank(q, 'mississippi'), 4);
  assert.equal(suggestRank(q, 'banana'), null);
  assert.equal(normalizeAnswer('  The Nile!! '), 'nile');
});
