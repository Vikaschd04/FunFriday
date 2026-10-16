import { describe, expect, it } from 'vitest';
import { answerForKey, parseShortcutsSetting } from './shortcuts';

const key = (k: string, extra = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  ...extra,
});

describe('shortcut settings', () => {
  it('defaults on and only an explicit "off" disables', () => {
    expect(parseShortcutsSetting(null)).toBe(true);
    expect(parseShortcutsSetting('on')).toBe(true);
    expect(parseShortcutsSetting('off')).toBe(false);
  });
  it('maps 1/2/0 and ignores modified or repeated keys', () => {
    expect(answerForKey(key('1'))).toBe('A');
    expect(answerForKey(key('2'))).toBe('B');
    expect(answerForKey(key('0'))).toBe('pass');
    expect(answerForKey(key('3'))).toBeNull();
    expect(answerForKey(key('1', { ctrlKey: true }))).toBeNull();
    expect(answerForKey(key('1', { shiftKey: true }))).toBeNull();
    expect(answerForKey(key('1', { repeat: true }))).toBeNull();
  });
});
