import test from 'node:test';
import assert from 'node:assert/strict';
import {bufferNotice} from '../buffer-status.js';
const job={steps:[{label:'Set mat'},{label:'Cut 1/1 · pass 1/1'},{label:'Return to origin'}]};
test('outstanding operation stays uncertain through sending and failure',()=>{
 for(const phase of ['sending','failed'])assert.match(bufferNotice({job,active:1,completed:0,phase}),/^Up to 1 operation/);
 assert.match(bufferNotice({job,active:1,completed:0,phase:'waiting'}),/^1 operation sent; completion not yet confirmed/);
 assert.match(bufferNotice({job,active:1,completed:1,phase:'completed'}),/^0 cut or crease/);
});
test('setup, initial failure, completion and simulation do not claim buffered cuts',()=>{
 assert.match(bufferNotice({job,active:2,completed:1,phase:'failed'}),/return movement may still be active/);
 assert.match(bufferNotice({job,active:-1,completed:-1,phase:'failed'}),/^Buffer state unknown/);
 assert.equal(bufferNotice({job,active:-1,completed:2,phase:'complete'}),'0 cut or crease operations outstanding.');
 assert.match(bufferNotice({job,active:1,completed:0,phase:'waiting'},true),/^Dry run/);
});
