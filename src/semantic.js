(function(M){
  'use strict';
  M.analyze = function(ast){
    const symbols=[],trace=[],diagnostics=[],scopes=[];let scopeId=0;
    const phase='Semantic Analysis';
    const log=(action,detail,span)=>M.trace(trace,phase,action,detail,span);
    const bad=(message,span)=>{diagnostics.push({phase,message,span});log('Error',message,span);return null;};
    const enter=span=>{const s={id:scopeId++,names:new Map()};scopes.push(s);log('Enter scope',`Scope ${s.id}`,span);};
    const leave=span=>{log('Leave scope',`Scope ${scopes.pop().id}`,span);};
    const lookup=name=>{for(let i=scopes.length-1;i>=0;i--)if(scopes[i].names.has(name))return scopes[i].names.get(name);return null;};
    const resolve=n=>{const s=lookup(n.name);if(!s){bad(`Variable '${n.name}' is not declared in this scope.`,n.nameSpan||n.span);return null;}n.symbolId=s.id;log('Resolve name',`${n.name} → ${s.id} (${s.type})`,n.nameSpan||n.span);return s;};
    const numeric=t=>t==='int'||t==='real';
    const compatible=(target,actual,n)=>{
      if(!actual)return;
      if(target===actual)log('Check assignment',`${actual} → ${target}: valid`,n.span);
      else if(target==='real'&&actual==='int'){n.widenTo='real';log('Widen integer','int → real: allowed',n.span);}
      else bad(`Cannot assign ${actual} to ${target}.`,n.span);
    };
    function expression(n){
      let type=null;
      if(n.kind==='Literal')type=n.literalType;
      else if(n.kind==='Name')type=resolve(n)?.type||null;
      else if(n.kind==='Unary'){
        const t=expression(n.operand);
        if(t){if(n.operator==='!'&&t==='bool')type='bool';else if(n.operator!=='!'&&numeric(t))type=t;else bad(`Operator '${n.operator}' cannot be applied to ${t}.`,n.span);}
      }else if(n.kind==='Binary'){
        const a=expression(n.left),b=expression(n.right),op=n.operator;
        if(a&&b){
          if(['&&','||'].includes(op)){if(a==='bool'&&b==='bool')type='bool';}
          else if(['==','!='].includes(op)){if(a===b||(numeric(a)&&numeric(b)))type='bool';}
          else if(['<','<=','>','>='].includes(op)){if(numeric(a)&&numeric(b))type='bool';}
          else if(op==='+'&&a==='text'&&b==='text')type='text';
          else if(op==='%'){if(a==='int'&&b==='int')type='int';}
          else if(numeric(a)&&numeric(b))type=op==='/'||a==='real'||b==='real'?'real':'int';
          if(!type)bad(`Operator '${op}' does not accept ${a} and ${b}.`,n.span);
          if(type&&numeric(a)&&numeric(b)&&(a==='real'||b==='real'||op==='/')){
            if(a==='int')n.left.widenTo='real';if(b==='int')n.right.widenTo='real';
          }
        }
      }
      n.valueType=type;
      if(type)log('Infer type',`${n.kind}${n.operator?' '+n.operator:''} → ${type}`,n.span);
      return type;
    }
    function block(n){enter(n.span);n.statements.forEach(statement);leave(n.span);}
    function statement(n){
      if(n.kind==='Declare'){
        const actual=expression(n.initializer);compatible(n.declaredType,actual,n.initializer);
        if(lookup(n.name))bad(`Duplicate or shadowed declaration '${n.name}'.`,n.nameSpan);
        else {const scope=scopes.at(-1),s={id:'s'+symbols.length,name:n.name,type:n.declaredType,scopeId:scope.id,span:n.nameSpan};n.symbolId=s.id;symbols.push(s);scope.names.set(n.name,s);log('Declare symbol',`${n.name}: ${s.type}, scope ${scope.id}, storage ${s.id}`,s.span);}
      }else if(n.kind==='Assign'){const s=resolve(n),t=expression(n.expression);if(s)compatible(s.type,t,n.expression);}
      else if(n.kind==='Show')expression(n.expression);
      else if(n.kind==='When'){
        const t=expression(n.condition);if(t&&t!=='bool')bad('A when condition must have type bool.',n.condition.span);
        else if(t)log('Check condition','bool condition: valid',n.condition.span);
        block(n.consequent);if(n.alternate)block(n.alternate);
      }
    }
    try {block(ast);return {ast,symbols,trace,diagnostics};}
    catch(e){if(e instanceof M.CompilationError)e.partial={ast,symbols,trace,diagnostics};throw e;}
  };
})(globalThis.MiniLang);

