import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOverflowingContractPageNumbers,
  openContractPrint,
} from './contractPrint.js';

test('contract print view opens in an isolated tab with an encoded id', () => {
  let call;
  globalThis.window = {
    open: (...args) => { call = args; },
  };
  try {
    openContractPrint('contract/id');
    assert.deepEqual(call, ['/contracts/contract%2Fid/print', '_blank', 'noopener,noreferrer']);
  } finally {
    delete globalThis.window;
  }
});

test('missing contract id does not open a tab', () => {
  let called = false;
  globalThis.window = { open: () => { called = true; } };
  try {
    openContractPrint('');
    assert.equal(called, false);
  } finally {
    delete globalThis.window;
  }
});

test('contract page overflow check reports only pages exceeding the A4 content area', () => {
  const pages = [
    { scrollHeight: 900, clientHeight: 900 },
    { scrollHeight: 902, clientHeight: 900 },
    { scrollHeight: 901, clientHeight: 900 },
  ];
  const root = { querySelectorAll: () => pages };

  assert.deepEqual(getOverflowingContractPageNumbers(root), [2]);
});

test('contract page overflow check safely handles a missing root', () => {
  assert.deepEqual(getOverflowingContractPageNumbers(null), []);
});
