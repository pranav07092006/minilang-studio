(function(M){
  'use strict';
  M.createVM=function(target){
    const vm={state:null,history:[],reset,step,run};
    function reset(){vm.state={pc:0,registers:{},memory:{},output:[],halted:false,error:null,steps:0};vm.history=[];}
    function step(){
      const s=vm.state;if(s.halted)return null;
      const pc=s.pc,i=target[pc],changes=[],output=[];
      const span=i?.span||{start:0,end:0,line:1,column:1};
      const error=message=>M.fail('Execution',message,span);
      const get=r=>{if(!Object.hasOwn(s.registers,r))error('Register '+r+' is not initialized.');return s.registers[r];};
      const put=(area,key,value)=>{const before=s[area][key];s[area][key]=value;changes.push({area,key,before,after:value});};
      const checked=(v,type)=>{
        if(typeof v==='number'&&(!Number.isFinite(v)||(type==='int'&&!Number.isSafeInteger(v))))error('Numeric overflow: result is outside the supported range.');
        if(typeof v==='string'&&v.length>M.limits.text)error('Text result exceeds 1,000,000 characters.');
        return v;
      };
      try{
        if(s.steps>=M.limits.steps)error('Execution limit exceeded (50,000 instructions).');
        if(!i)error('Instruction pointer is outside target code.');
        s.steps++;let next=pc+1;const [a,b,c,type]=i.args;
        switch(i.op){
          case 'LOAD_CONST':put('registers',a,b);break;
          case 'LOAD':if(!Object.hasOwn(s.memory,b))error('Variable '+b+' has no runtime value.');put('registers',a,s.memory[b]);break;
          case 'STORE':put('memory',a,get(b));break;
          case 'MOV':case 'INT_TO_REAL':put('registers',a,get(b));break;
          case 'NEG':put('registers',a,checked(-get(b),c));break;
          case 'POS':put('registers',a,checked(+get(b),c));break;
          case 'NOT':put('registers',a,!get(b));break;
          case 'JUMP':next=a;break;
          case 'JUMP_IF_FALSE':if(get(a)===false)next=b;break;
          case 'PRINT':{const value=String(get(a));s.output.push(value);output.push(value);break;}
          case 'HALT':s.halted=true;break;
          default:{
            const x=get(b),y=get(c);let v;
            if((i.op==='DIV'||i.op==='MOD')&&y===0)error('Division or remainder by zero.');
            switch(i.op){case 'ADD':if(typeof x==='string'&&x.length+y.length>M.limits.text)error('Text result exceeds 1,000,000 characters.');v=x+y;break;case 'SUB':v=x-y;break;case 'MUL':v=x*y;break;case 'DIV':v=x/y;break;case 'MOD':v=x%y;break;case 'EQ':v=x===y;break;case 'NE':v=x!==y;break;case 'LT':v=x<y;break;case 'LE':v=x<=y;break;case 'GT':v=x>y;break;case 'GE':v=x>=y;break;default:error('Unknown instruction '+i.op);}
            put('registers',a,checked(v,type));
          }
        }
        s.pc=next;
      }catch(e){if(!(e instanceof M.CompilationError))throw e;s.error=e.diagnostic;s.halted=true;}
      const event={pc,instruction:i,span,changes,output,nextPC:s.pc,error:s.error};vm.history.push(event);return event;
    }
    function run(){while(!vm.state.halted)step();return vm.state;}
    reset();return vm;
  };
})(globalThis.MiniLang);

