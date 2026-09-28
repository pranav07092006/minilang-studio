(function (M) {
  'use strict';
  M.lex = function (source) {
    const tokens = [], trace = [], phase = 'Lexical Analysis';
    let i = 0, line = 1, column = 1;
    const pos = () => ({start:i, end:i+1, line, column});
    const advance = () => { const c=source[i++]; if(c==='\n'){line++;column=1;}else column++; return c; };
    const keywords = new Set(['begin','end','let','int','real','bool','text','when','otherwise','show','true','false']);
    try {
      if(source.length > M.limits.source) M.fail(phase,'Source exceeds 50,000 characters.',pos());
      while(i < source.length) {
        const span=pos(), c=source[i];
        if(/\s/.test(c)) {
          while(i<source.length && /\s/.test(source[i])) advance();
          span.end=i; M.trace(trace,phase,'Skip whitespace',`${i-span.start} character(s)`,span); continue;
        }
        if(source.slice(i,i+2)==='//') {
          while(i<source.length && source[i]!=='\n') advance();
          span.end=i; M.trace(trace,phase,'Skip comment',source.slice(span.start,i),span); continue;
        }
        let kind, value;
        if(/[A-Za-z_]/.test(c)) {
          while(i<source.length && /[A-Za-z0-9_]/.test(source[i])) advance();
          value=source.slice(span.start,i); kind=keywords.has(value)?'KEYWORD':'IDENTIFIER';
        } else if(/[0-9]/.test(c)) {
          while(i<source.length && /[0-9]/.test(source[i])) advance();
          kind='INT';
          if(source[i]==='.' && /[0-9]/.test(source[i+1]||'')) {
            kind='REAL'; advance(); while(i<source.length && /[0-9]/.test(source[i])) advance();
          }
          value=Number(source.slice(span.start,i));
          if(!Number.isFinite(value) || (kind==='INT' && !Number.isSafeInteger(value))) M.fail(phase,'Numeric literal is outside the supported range.',span);
        } else if(c==='"') {
          kind='TEXT'; value=''; advance();
          while(i<source.length && source[i]!=='"') {
            if(source[i]==='\n' || source[i]==='\r') M.fail(phase,'Text literal cannot contain a raw newline; use \\n.',pos());
            if(source[i]==='\\') {
              const escapePos=pos(); advance(); const e=advance();
              const escapes={'n':'\n','t':'\t','"':'"','\\':'\\'};
              if(!Object.hasOwn(escapes,e)) M.fail(phase,'Invalid text escape. Use \\n, \\t, \\" or \\\\.',escapePos);
              value+=escapes[e];
            } else value+=advance();
          }
          if(source[i]!=='"') M.fail(phase,'Unterminated text literal.',span);
          advance();
        } else {
          const pair=source.slice(i,i+2);
          if(['==','!=','<=','>=','&&','||'].includes(pair)){advance();advance();kind='OPERATOR';value=pair;}
          else if('+-*/%!=<>'.includes(c)){value=advance();kind='OPERATOR';}
          else if('():;{}'.includes(c)){value=advance();kind='DELIMITER';}
          else M.fail(phase,`Unexpected character ${JSON.stringify(c)}.`,span);
        }
        span.end=i; const lexeme=source.slice(span.start,i);
        tokens.push({kind,lexeme,value,span}); M.trace(trace,phase,'Recognize '+kind,lexeme,span);
      }
      tokens.push({kind:'EOF',lexeme:'',value:null,span:{...pos(),end:i}});
      return {tokens,trace};
    } catch(e) { if(e instanceof M.CompilationError)e.partial={tokens,trace}; throw e; }
  };
})(globalThis.MiniLang);

