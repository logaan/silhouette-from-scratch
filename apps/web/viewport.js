export function panView(view,dx,dy,pixelsWide,pixelsHigh){
 return {...view,x:view.x+dx*view.width/pixelsWide,y:view.y+dy*view.height/pixelsHigh};
}
export function zoomView(view,base,delta,anchor){
 const factor=Math.exp(Math.max(-1,Math.min(1,delta*0.01)));
 const width=Math.max(base.width/8,Math.min(base.width*4,view.width*factor));
 const ratio=width/view.width;
 return {x:anchor.x-(anchor.x-view.x)*ratio,y:anchor.y-(anchor.y-view.y)*ratio,width,height:view.height*ratio};
}
