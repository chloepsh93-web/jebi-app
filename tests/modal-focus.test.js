import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountModalFocus } from '../lib/modalFocus.js';

function setup() {
  const dom = new JSDOM('<body><button id="trigger">Open</button><section id="sheet" tabindex="-1"><button id="first">Cancel</button><button disabled>Disabled</button><button id="last">Save</button></section><section id="confirm" tabindex="-1"><button id="cancel">Cancel</button><button id="delete">Delete</button></section></body>');
  global.document = dom.window.document;
  dom.window.HTMLElement.prototype.getClientRects = function () { return [{}]; };
  const get = (id) => document.getElementById(id);
  const key = (value, shiftKey = false) => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }));
  get('trigger').focus();
  return { dom, get, key };
}

test('initial focus is cancel; Tab wraps; closing restores trigger and scroll', () => {
  const { get, key } = setup();
  document.body.style.overflow = 'auto';
  const remove = mountModalFocus(get('sheet'), () => {});
  assert.equal(document.activeElement, get('first'));
  assert.equal(document.body.style.overflow, 'hidden');
  key('Tab', true);
  assert.equal(document.activeElement, get('last'));
  key('Tab');
  assert.equal(document.activeElement, get('first'));
  remove();
  assert.equal(document.activeElement, get('trigger'));
  assert.equal(document.body.style.overflow, 'auto');
});

test('only top dialog responds to Escape and focus returns into lower sheet', () => {
  const { get, key } = setup();
  let sheetClose = 0, confirmClose = 0;
  const lower = mountModalFocus(get('sheet'), () => sheetClose++);
  get('last').focus();
  const upper = mountModalFocus(get('confirm'), () => confirmClose++);
  key('Escape');
  assert.equal(confirmClose, 1);
  assert.equal(sheetClose, 0);
  upper();
  assert.equal(document.activeElement, get('last'));
  assert.equal(document.body.style.overflow, 'hidden');
  key('Escape');
  assert.equal(sheetClose, 1);
  lower();
});

test('programmatic background focus is contained; hidden controls excluded', () => {
  const { get } = setup();
  get('first').hidden = true;
  const remove = mountModalFocus(get('sheet'), () => {});
  assert.equal(document.activeElement, get('last'));
  get('trigger').focus();
  assert.equal(document.activeElement, get('last'));
  remove();
});

test('empty dialog remains focusable and cleanup is idempotent', () => {
  const { get, key } = setup();
  get('sheet').replaceChildren();
  const remove = mountModalFocus(get('sheet'), () => {});
  assert.equal(document.activeElement, get('sheet'));
  key('Tab');
  assert.equal(document.activeElement, get('sheet'));
  remove(); remove();
  assert.equal(document.body.style.overflow, '');
});

test('unmounting lower dialog first preserves original scroll state', () => {
  const { get } = setup();
  document.body.style.overflow = 'scroll';
  const lower = mountModalFocus(get('sheet'), () => {});
  const upper = mountModalFocus(get('confirm'), () => {});
  lower();
  assert.equal(document.body.style.overflow, 'hidden');
  upper();
  assert.equal(document.body.style.overflow, 'scroll');
});
