import {CameoBluetooth} from './bluetooth.js';
export class DryRunCameo extends CameoBluetooth{
 constructor(onState=()=>{}){super(onState);this.simulated=true;this.identity='Simulated Cameo';}
 async connect(){this.connected=true;this.stopped=false;this.onState('Simulated Cameo connected');return this.identity;}
 disconnect(){this.stop();this.connected=false;this.onState('Simulated Cameo disconnected');}
 async send(bytes){
  if(this.stopped||!this.connected)throw Error('Simulation stopped');
  this.log.push({time:new Date().toISOString(),direction:'simulation',commands:new TextDecoder().decode(bytes).split('\x03').filter(Boolean)});
 }
 async ready(){await new Promise(resolve=>setTimeout(resolve,0));if(this.stopped||!this.connected)throw Error('Simulation stopped');}
}
