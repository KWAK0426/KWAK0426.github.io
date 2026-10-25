import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spectrumEnvelope} from '../../../drone/viewer/spectra.js';

test('band-wise sample envelope preserves wavelengths and input values', () => {
  const input = [[1,9,3],[4,2,6],[2,5,0]];
  const before = structuredClone(input);
  assert.deepEqual(spectrumEnvelope(input,.5), {min:[.5,1,0],max:[2,4.5,3],count:3});
  assert.deepEqual(input,before);
  assert.deepEqual(spectrumEnvelope([[0,2]]),{min:[0,2],max:[0,2],count:1});
});

test('invalid sample sets do not produce a misleading shaded range', () => {
  for (const input of [null,[],{},[null],[[1],[1,2]],[[NaN]],[[Infinity]]]) {
    assert.equal(spectrumEnvelope(input),null);
  }
  for (const scale of [0,-1,NaN,Infinity]) assert.equal(spectrumEnvelope([[1]],scale),null);
  assert.equal(spectrumEnvelope([[Number.MAX_VALUE]],2),null);
});
