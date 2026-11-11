export const isDryRun=()=>['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&document.querySelector('meta[name="dry-run"]')?.content==='true';
