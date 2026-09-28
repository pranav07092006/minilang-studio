(function(M){
  'use strict';
  M.generateTarget=function(tac){
    const instructions=[],labels=new Map(),fixups=[];
    const binary={'+':'ADD','-':'SUB','*':'MUL','/':'DIV','%':'MOD','==':'EQ','!=':'NE','<':'LT','<=':'LE','>':'GT','>=':'GE'};
    tac.forEach((i,tacIndex)=>{
      const emit=(op,args=[])=>{instructions.push({op,args,span:i.span,tacIndex});return instructions.length-1;};
      const load=(o,r)=>{if(o.kind==='constant')emit('LOAD_CONST',[r,o.value]);else if(o.kind==='symbol')emit('LOAD',[r,o.value]);else emit('MOV',[r,o.value]);};
      const write=(o,r)=>{if(o.kind==='symbol')emit('STORE',[o.value,r]);else emit('MOV',[o.value,r]);};
      if(i.op==='LABEL')labels.set(i.label,instructions.length);
      else if(i.op==='MOVE'){load(i.args[0],'ra');write(i.result,'ra');}
      else if(i.op==='BINARY'){load(i.args[0],'ra');load(i.args[1],'rb');emit(binary[i.operator],[i.result.value,'ra','rb',i.result.type]);}
      else if(i.op==='UNARY'){load(i.args[0],'ra');emit({'!':'NOT','-':'NEG','+':'POS'}[i.operator],[i.result.value,'ra',i.result.type]);}
      else if(i.op==='CAST'){load(i.args[0],'ra');emit('INT_TO_REAL',[i.result.value,'ra']);}
      else if(i.op==='PRINT'){load(i.args[0],'ra');emit('PRINT',['ra']);}
      else if(i.op==='JZ'){load(i.args[0],'ra');fixups.push([emit('JUMP_IF_FALSE',['ra',null]),1,i.label]);}
      else if(i.op==='JUMP')fixups.push([emit('JUMP',[null]),0,i.label]);
      else emit('HALT');
    });
    for(const [pc,arg,label]of fixups){if(!labels.has(label))throw new Error('Unresolved target label '+label);instructions[pc].args[arg]=labels.get(label);}
    return {instructions};
  };
  M.targetText=i=>i.op+' '+i.args.map((a,j)=>i.op==='LOAD_CONST'&&j===1?M.format(a):String(a)).join(', ');
})(globalThis.MiniLang);

