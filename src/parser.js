(function(M){
  'use strict';
  M.parse = function(tokens) {
    const trace=[], phase='Syntax Analysis'; let i=0, depth=0;
    const peek=()=>tokens[i];
    const error=(message)=>M.fail(phase,message,peek().span);
    const at=s=>peek().lexeme===s;
    const consume=()=>{const t=tokens[i++];M.trace(trace,phase,'Consume token',`${t.kind}: ${t.lexeme||'EOF'}`,t.span);return t;};
    const expect=s=>{if(!at(s))error(`Expected '${s}', found '${peek().lexeme||'end of input'}'.`);return consume();};
    const production=(detail)=>M.trace(trace,phase,'Apply grammar',detail,peek().span);
    const guarded=fn=>{depth++;if(depth>M.limits.depth)error('Nesting exceeds 128 levels.');try{return fn();}finally{depth--;}};
    const node=(kind,start,fields)=>({kind,span:{...start.span,end:tokens[Math.max(0,i-1)].span.end},...fields});
    const identifier=()=>{if(peek().kind!=='IDENTIFIER')error('Expected a variable identifier.');return consume();};
    const precedence={'||':1,'&&':2,'==':3,'!=':3,'<':4,'<=':4,'>':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
    function expression(min=1) {return guarded(()=>{
      let left=primary();
      while((precedence[peek().lexeme]||0)>=min){
        const op=consume(), right=expression(precedence[op.lexeme]+1);
        left=node('Binary',{span:left.span},{operator:op.lexeme,left,right});
      }
      return left;
    });}
    function primary(){return guarded(()=>{
      const t=peek();
      if(['!','-','+'].includes(t.lexeme)){consume();return node('Unary',t,{operator:t.lexeme,operand:primary()});}
      if(at('(')){consume();const e=expression();expect(')');return e;}
      if(['INT','REAL','TEXT'].includes(t.kind)||['true','false'].includes(t.lexeme)){
        consume();return node('Literal',t,{value:t.lexeme==='true'?true:t.lexeme==='false'?false:t.value,literalType:t.kind==='KEYWORD'?'bool':t.kind.toLowerCase()});
      }
      if(t.kind==='IDENTIFIER'){consume();return node('Name',t,{name:t.lexeme});}
      error('Expected a literal, variable, unary operator, or parenthesized expression.');
    });}
    function block(){return guarded(()=>{production('block → { statement* }');const t=expect('{'),statements=[];while(!at('}')&&peek().kind!=='EOF')statements.push(statement());expect('}');return node('Block',t,{statements});});}
    function statement(){return guarded(()=>{
      const t=peek();
      if(at('let')){
        production('declaration → let identifier : type = expression ;');consume();const name=identifier();expect(':');
        if(!['int','real','bool','text'].includes(peek().lexeme))error('Expected type int, real, bool, or text.');
        const declaredType=consume().lexeme;expect('=');const initializer=expression();expect(';');return node('Declare',t,{name:name.lexeme,nameSpan:name.span,declaredType,initializer});
      }
      if(at('show')){production('output → show ( expression ) ;');consume();expect('(');const e=expression();expect(')');expect(';');return node('Show',t,{expression:e});}
      if(at('when')){production('conditional → when ( expression ) block [ otherwise block ]');consume();expect('(');const condition=expression();expect(')');const consequent=block();let alternate=null;if(at('otherwise')){consume();alternate=block();}return node('When',t,{condition,consequent,alternate});}
      if(t.kind==='IDENTIFIER'){production('assignment → identifier = expression ;');const name=consume();expect('=');const e=expression();expect(';');return node('Assign',t,{name:name.lexeme,nameSpan:name.span,expression:e});}
      error('Expected let, show, when, or an assignment.');
    });}
    try{
      production('program → begin statement* end EOF');const start=expect('begin'),statements=[];
      while(!at('end') && peek().kind!=='EOF')statements.push(statement());expect('end');
      if(peek().kind!=='EOF')error('Unexpected text after end.');consume();
      const ast=node('Program',start,{statements});
      const stack=[[ast,1]];
      while(stack.length){const [n,d]=stack.pop();if(d>M.limits.depth)M.fail(phase,'AST depth exceeds 128 levels.',n.span);for(const v of Object.values(n)){if(v?.kind)stack.push([v,d+1]);else if(Array.isArray(v))v.forEach(x=>{if(x?.kind)stack.push([x,d+1]);});}}
      return {ast,trace};
    }catch(e){if(e instanceof M.CompilationError)e.partial={trace};throw e;}
  };
})(globalThis.MiniLang);

