export function bufferNotice(run,dryRun=false){
 if(dryRun)return 'Dry run — no operations are buffered in a machine.';
 const step=run.job.steps[run.active],pending=run.active>run.completed&&run.phase!=='complete';
 if(pending&&/^(Cut|Crease) /.test(step?.label)){
  if(run.phase==='waiting')return '1 operation sent; completion not yet confirmed. No additional cut or crease operations are queued.';
  return 'Up to 1 operation may still be moving or buffered; completion is unconfirmed. No additional cut or crease operations are queued.';
 }
 if(pending&&step)return '0 cut or crease operations outstanding. Setup or return movement may still be active.';
 if(run.phase==='failed')return 'Buffer state unknown. No cut or crease operations were sent by this job.';
 return '0 cut or crease operations outstanding.';
}
