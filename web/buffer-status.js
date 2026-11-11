export function bufferNotice(run,dryRun=false){
 if(dryRun)return 'Dry run — no operations are buffered in a machine.';
 const queued=(run.outstanding||[]).filter(i=>/^(Cut|Crease) /.test(run.job.steps[i]?.label)).length;
 if(queued>1)return `Up to ${queued} operations sent or being sent; batch completion is unconfirmed. The Cameo does not report the exact queue depth or active operation.`;
 const step=run.job.steps[run.active],pending=run.active>run.completed&&run.phase!=='complete';
 if(pending&&/^(Cut|Crease) /.test(step?.label)){
  if(run.phase==='waiting')return '1 operation sent; completion not yet confirmed. No additional cut or crease operations have been sent.';
  return 'Up to 1 operation may still be moving or buffered; completion is unconfirmed. No additional cut or crease operations have been sent.';
 }
 if(pending&&step)return '0 cut or crease operations outstanding. Setup or return movement may still be active.';
 if(run.phase==='failed')return 'Buffer state unknown. No cut or crease operations remain unconfirmed by this job.';
 return '0 cut or crease operations outstanding.';
}
