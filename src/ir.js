(function(M){
  'use strict';
  M.generateIR=function(ast){
    const instructions=[];let tempId=0,labelId=0;
    const temporary=type=>({kind:'temporary',value:'t'+tempId++,type});
    const constant=(value,type)=>({kind:'constant',value,type});
    const label=()=> 'L'+labelId++;
    const emit=(op,args,result,span,extra={})=>instructions.push({op,args,result,span,...extra});
    function expr(n){
      let value;
      if(n.kind==='Literal')value=constant(n.value,n.valueType);
      else if(n.kind==='Name')value={kind:'symbol',value:n.symbolId,type:n.valueType};
      else if(n.kind==='Unary'){const a=expr(n.operand);value=temporary(n.valueType);emit('UNARY',[a],value,n.span,{operator:n.operator});}
      else if(n.kind==='Binary'){
        value=temporary(n.valueType);
        if(n.operator==='&&'){
          const end=label();emit('MOVE',[constant(false,'bool')],value,n.span);
          emit('JZ',[expr(n.left)],null,n.left.span,{label:end});emit('MOVE',[expr(n.right)],value,n.right.span);emit('LABEL',[],null,n.span,{label:end});
        }else if(n.operator==='||'){
          const right=label(),end=label();emit('MOVE',[constant(true,'bool')],value,n.span);
          emit('JZ',[expr(n.left)],null,n.left.span,{label:right});emit('JUMP',[],null,n.span,{label:end});emit('LABEL',[],null,n.span,{label:right});
          emit('MOVE',[expr(n.right)],value,n.right.span);emit('LABEL',[],null,n.span,{label:end});
        }else{const left=expr(n.left),right=expr(n.right);emit('BINARY',[left,right],value,n.span,{operator:n.operator});}
      }
      if(n.widenTo==='real'){const widened=temporary('real');emit('CAST',[value],widened,n.span);value=widened;}
      return value;
    }
    function statement(n){
      if(n.kind==='Declare')emit('MOVE',[expr(n.initializer)],{kind:'symbol',value:n.symbolId,type:n.declaredType},n.span);
      else if(n.kind==='Assign'){const v=expr(n.expression);emit('MOVE',[v],{kind:'symbol',value:n.symbolId,type:v.type},n.span);}
      else if(n.kind==='Show')emit('PRINT',[expr(n.expression)],null,n.span);
      else if(n.kind==='When'){
        const no=label(),end=label();emit('JZ',[expr(n.condition)],null,n.condition.span,{label:no});n.consequent.statements.forEach(statement);
        emit('JUMP',[],null,n.span,{label:end});emit('LABEL',[],null,n.span,{label:no});if(n.alternate)n.alternate.statements.forEach(statement);emit('LABEL',[],null,n.span,{label:end});
      }
    }
    ast.statements.forEach(statement);emit('HALT',[],null,ast.span);return {instructions};
  };
  M.operandText=o=>o.kind==='constant'?M.format(o.value):o.value;
  M.tacText=i=>{
    const a=i.args.map(M.operandText),r=i.result?M.operandText(i.result):'';
    switch(i.op){case 'BINARY':return `${r} = ${a[0]} ${i.operator} ${a[1]}`;case 'UNARY':return `${r} = ${i.operator}${a[0]}`;case 'MOVE':return `${r} = ${a[0]}`;case 'CAST':return `${r} = real(${a[0]})`;case 'LABEL':return i.label+':';case 'JUMP':return 'goto '+i.label;case 'JZ':return `ifFalse ${a[0]} goto ${i.label}`;case 'PRINT':return 'print '+a[0];default:return i.op.toLowerCase();}
  };
})(globalThis.MiniLang);

