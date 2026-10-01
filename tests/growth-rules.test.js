import test from 'node:test';
import assert from 'node:assert/strict';
import { computeGourdState, GourdState, validateOccasionDate, isTransferRecord } from '../lib/model.js';
test('growth follows explicit actions, never elapsed time or spending amount', () => {
 const m={direction:'받음',amount:0,plantedAt:1,eventDate:'2000-01-01'};
 assert.equal(computeGourdState(m,1),GourdState.SPROUT);
 assert.equal(computeGourdState({...m,amount:10000000},Date.now()),GourdState.SPROUT);
 assert.equal(computeGourdState({...m,attendance:'planned'}),GourdState.GROWING);
 assert.equal(computeGourdState({...m,attendance:'attended'}),GourdState.RIPE);
 assert.equal(computeGourdState({...m,repaidAt:1}),GourdState.OPENED);
 assert.equal(isTransferRecord({...m,amount:null,attendance:'attended'}),false);
 assert.equal(computeGourdState({...m,amount:null,attendance:'attended'}),null);
});
test('editing rejects impossible dates and respects explicit unknown',()=>{
 assert.ok(validateOccasionDate({date:'2026-02-30'}).date);
 assert.deepEqual(validateOccasionDate({date:'2024-02-29'}),{});
 assert.deepEqual(validateOccasionDate({date:'',dateUnknown:true}),{});
});
