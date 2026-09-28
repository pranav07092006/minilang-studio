(function(M){
  'use strict';
  M.compile=function(source){
    const result={tokens:[],lexicalTrace:[],ast:null,parserTrace:[],symbols:[],semanticTrace:[],tac:null,target:null,diagnostics:[],failedPhase:null};
    let phase='Lexical Analysis';
    try{
      const lex=M.lex(source);result.tokens=lex.tokens;result.lexicalTrace=lex.trace;
      phase='Syntax Analysis';const parsed=M.parse(lex.tokens);result.ast=parsed.ast;result.parserTrace=parsed.trace;
      phase='Semantic Analysis';const sem=M.analyze(parsed.ast);result.symbols=sem.symbols;result.semanticTrace=sem.trace;result.diagnostics=sem.diagnostics;
      if(sem.diagnostics.length){result.failedPhase=phase;return result;}
      phase='Intermediate Code';result.tac=M.generateIR(sem.ast).instructions;
      phase='Target Code';result.target=M.generateTarget(result.tac).instructions;
    }catch(e){
      if(!(e instanceof M.CompilationError))throw e;
      result.failedPhase=e.diagnostic.phase;result.diagnostics.push(e.diagnostic);
      if(phase==='Lexical Analysis'){result.tokens=e.partial.tokens||[];result.lexicalTrace=e.partial.trace||[];}
      if(phase==='Syntax Analysis')result.parserTrace=e.partial.trace||[];
      if(phase==='Semantic Analysis'){result.symbols=e.partial.symbols||[];result.semanticTrace=e.partial.trace||[];result.diagnostics=[...(e.partial.diagnostics||[]),e.diagnostic];}
    }
    return result;
  };
})(globalThis.MiniLang);

