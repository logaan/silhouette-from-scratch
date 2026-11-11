import {isDryRun} from './dry-run.js';
const brands=navigator.userAgentData?.brands;
const chrome=brands?brands.some(({brand})=>brand==='Google Chrome'):/Chrome\//.test(navigator.userAgent)&&/Google Inc\./.test(navigator.vendor)&&!/Edg|OPR|Opera|SamsungBrowser|Vivaldi/.test(navigator.userAgent)&&!navigator.brave;
if(isDryRun()||(chrome&&navigator.bluetooth)){
 await import('./app.js');
}else{
 document.getElementById('browser-notice').hidden=false;
 document.body.classList.add('browser-blocked');
 for(const el of document.querySelectorAll('input,select,textarea,button'))el.disabled=true;
 for(const el of document.querySelectorAll('header,main,dialog'))el.inert=true;
 document.getElementById('connection').textContent='Chrome required';
 document.getElementById('progress-label').textContent='Open this page in Google Chrome with Bluetooth support.';
}
