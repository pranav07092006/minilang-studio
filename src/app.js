(function(M){
  'use strict';
  const $=id=>document.getElementById(id),source=$('source');
  let compilation=null,vm=null,phase=0,revealed=0;const pages={};
  const descriptions=[
    'The starting point: a program written using our own syntax and language rules.',
    'The scanner reads characters and recognizes keywords, identifiers, constants, operators, and delimiters.',
    'The parser consumes tokens and applies grammar rules to check the structure of your program.',
    'The syntax tree preserves the meaning and nesting of your program, without punctuation or comments.',
    'Every declaration receives a unique storage identity. Scopes decide where each name can be used.',
    'The analyzer resolves names, infers types, and checks assignments and conditions before code generation.',
    'Expressions become small three-address operations. Labels and jumps make control flow explicit.',
    'Three-address code becomes instructions for our register-based virtual machine. Jump addresses are resolved.',
    'Execute one target instruction at a time. Inspect the instruction pointer, memory, registers, and every state change.',
    'Only executed PRINT instructions produce output. This is the result of running the generated target code.'
  ];
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const code=s=>'<code>'+esc(s)+'</code>';
  const loc=s=>s?`${s.line}:${s.column}`:'—';
  const label=s=>'<div class="section-label">'+esc(s)+'</div>';
  const empty=s=>'<div class="empty">'+esc(s)+'</div>';
  const stat=s=>'<span class="stat">'+esc(s)+'</span>';
  const table=(heads,rows)=>'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>Array.isArray(r)?'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>':r).join('')+'</tbody></table></div>';
  const row=(cells,cls='')=>'<tr class="'+cls+'">'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
  function paged(key,heads,data,mapper){
    const count=Math.max(1,Math.ceil(data.length/100)),p=Math.min(pages[key]||0,count-1);pages[key]=p;
    const controls=count>1?`<div class="pager"><button data-page="${key}" data-delta="-1" ${p===0?'disabled':''}>← Previous</button><span>Rows ${p*100+1}–${Math.min((p+1)*100,data.length)} of ${data.length}</span><button data-page="${key}" data-delta="1" ${p===count-1?'disabled':''}>Next →</button></div>`:'';
    return controls+table(heads,data.slice(p*100,(p+1)*100).map((d,j)=>mapper(d,p*100+j)))+controls;
  }
  const trace=(key,events)=>paged(key,['#','ACTION','DETAIL','LINE:COL'],events,(t,i)=>[esc(i+1),'<span class="'+(t.action==='Error'?'trace-fail':'')+'">'+esc(t.action)+'</span>',code(t.detail),esc(loc(t.span))]);
  function tree(n,depth=0){
    const meta=[n.name,n.operator,n.kind==='Literal'?M.format(n.value):null,n.declaredType].filter(v=>v!==undefined&&v!==null).join(' ');
    const children=[];for(const [k,v]of Object.entries(n)){if(v?.kind)children.push([k,v]);else if(Array.isArray(v))v.forEach((x,i)=>{if(x?.kind)children.push([k+' '+(i+1),x]);});}
    const title=esc(n.kind)+(meta?' · '+esc(meta):'')+` <small>${esc(loc(n.span))}${n.valueType?' · '+esc(n.valueType):''}</small>`;
    return children.length?`<details ${depth<3?'open':''}><summary>${title}</summary>${children.map(([k,v])=>'<div class="leaf">'+esc(k)+'</div>'+tree(v,depth+1)).join('')}</details>`:'<div class="leaf">'+title+'</div>';
  }
  const grammar=`program     = "begin" { statement } "end" EOF ;
statement   = declaration | assignment | conditional | output ;
declaration = "let" identifier ":" type "=" expression ";" ;
assignment  = identifier "=" expression ";" ;
conditional = "when" "(" expression ")" block
              [ "otherwise" block ] ;
block       = "{" { statement } "}" ;
output      = "show" "(" expression ")" ";" ;
type        = "int" | "real" | "bool" | "text" ;
expression  = or ;
or          = and { "||" and } ;
and         = equality { "&&" equality } ;
equality    = comparison { ("==" | "!=") comparison } ;
comparison  = addition { ("<" | "<=" | ">" | ">=") addition } ;
addition    = product { ("+" | "-") product } ;
product     = unary { ("*" | "/" | "%") unary } ;
unary       = ("!" | "-" | "+") unary | primary ;
primary     = literal | identifier | "(" expression ")" ;`;
  function guide(){return `<div class="guide-intro"><h3>Small language. Real compiler.</h3><p>MiniLang has its own grammar, type system, intermediate representation, and target instruction set. Start with the example, or write your own.</p><div class="tag-row"><span class="tag">int</span><span class="tag">real</span><span class="tag">bool</span><span class="tag">text</span></div></div><ol class="rule-list"><li><b>01</b><div><strong>Wrap your program in begin … end</strong>Declare variables with <code>let name : type = value;</code></div></li><li><b>02</b><div><strong>Make decisions with when / otherwise</strong>Use braces for blocks and a semicolon after statements.</div></li><li><b>03</b><div><strong>Display values with show(expression);</strong>Choose Next phase to explore, or Compile all to prepare execution.</div></li></ol><details class="reference"><summary>View the MiniLang grammar</summary><pre>${esc(grammar)}</pre></details>`;}
  function targetTable(){return paged('target',['PC','INSTRUCTION','TAC','LINE:COL'],compilation.target,(t,i)=>row([esc(String(i).padStart(3,'0')),code(M.targetText(t)),esc(t.tacIndex),esc(loc(t.span))],vm&&!vm.state.halted&&vm.state.pc===i?'current':vm?.history.at(-1)?.pc===i?'last':''));}
  function runtime(){
    const s=vm.state,last=vm.history.at(-1),status=s.error?'Stopped with error':s.halted?'Halted':'Ready';
    let html='<div class="summary-line">'+stat('PC '+s.pc)+stat(s.steps+' instructions executed')+stat(status)+'</div>';
    if(s.error)html+='<div class="notice">'+esc(s.error.message)+' · '+esc(loc(s.error.span))+'</div>';
    if(last)html+='<div class="notice"><strong>Last executed:</strong> '+code(last.pc+' · '+M.targetText(last.instruction))+'<br>Source '+esc(loc(last.span))+' → next PC '+s.pc+'</div>';
    html+=label('Target instructions · orange = next, green = last')+targetTable();
    html+=label('Variable storage')+table(['SYMBOL','NAME','TYPE','VALUE'],compilation.symbols.map(x=>[code(x.id),esc(x.name),esc(x.type),Object.hasOwn(s.memory,x.id)?code(M.format(s.memory[x.id])):'<span class="muted">Not initialized</span>']));
    html+=label('Registers')+(Object.keys(s.registers).length?table(['REGISTER','VALUE'],Object.entries(s.registers).map(([k,v])=>[code(k),code(M.format(v))])):empty('No registers written yet. Step to execute the first instruction.'));
    html+=label('Execution history · before → after')+(vm.history.length?paged('history',['STEP / PC','INSTRUCTION','STATE CHANGE'],vm.history,(e,i)=>[code((i+1)+' / '+e.pc),code(M.targetText(e.instruction)),e.changes.map(c=>code(`${c.area}.${c.key}: ${c.before===undefined?'∅':M.format(c.before)} → ${M.format(c.after)}`)).join('<br>')+(e.output.length?'<br>'+code('output += '+e.output.map(M.format).join(', ')):'')+(e.error?'<br><span class="trace-fail">'+esc(e.error.message)+'</span>':'')+(!e.changes.length&&!e.output.length&&!e.error?code('PC → '+e.nextPC):'')]):empty('Every instruction will appear here, including jumps and HALT.'));
    html+=label('Output so far')+consoleOutput();return html;
  }
  function consoleOutput(){return '<div class="console"><div class="console-caption">MINILANG / STANDARD OUTPUT</div>'+esc(vm?.state.output.join('\n')||'')+(!vm?.state.output.length?'<span class="muted">'+(vm?.state.halted?'Program produced no output.':'No output yet.')+'</span>':'')+'</div>';}
  function artifact(){
    if(phase===0)return guide();
    if(!compilation)return empty('Choose Next phase or Compile all to begin.');
    const c=compilation;
    switch(phase){
      case 1:return '<div class="summary-line">'+stat(c.tokens.filter(t=>t.kind!=='EOF').length+' tokens')+stat(c.lexicalTrace.length+' scanner events')+'</div>'+paged('tokens',['#','LEXEME','CATEGORY','VALUE','LINE:COL'],c.tokens,(t,i)=>[esc(i+1),code(t.lexeme||'EOF'),esc(t.kind),code(t.value===null?'—':M.format(t.value)),esc(loc(t.span))])+label('Scanner trace')+trace('lexical',c.lexicalTrace);
      case 2:return '<div class="summary-line">'+stat(c.ast?'Grammar accepted':'Parsing stopped')+stat(c.parserTrace.length+' parsing events')+'</div>'+trace('parser',c.parserTrace)+'<details class="reference"><summary>Grammar reference</summary><pre>'+esc(grammar)+'</pre></details>';
      case 3:return c.ast?'<div class="notice">Expand nodes to inspect operands and nested statements. Positions refer to your source program.</div><div class="tree">'+tree(c.ast)+'</div>':empty('No complete AST was generated.');
      case 4:return '<div class="summary-line">'+stat(c.symbols.length+' declared symbols')+'</div><div class="notice">This is the static symbol table. Actual runtime values appear in Execution. Name discovery and semantic checking share one internal traversal.</div>'+table(['ID','NAME','TYPE','SCOPE','DECLARED AT'],c.symbols.map(s=>[code(s.id),esc(s.name),esc(s.type),esc(s.scopeId),esc(loc(s.span))]));
      case 5:return '<div class="summary-line">'+stat(c.diagnostics.length?c.diagnostics.length+' error(s)':'All semantic checks passed')+'</div>'+trace('semantic',c.semanticTrace);
      case 6:return c.tac?paged('tac',['#','THREE-ADDRESS INSTRUCTION','LINE:COL'],c.tac,(i,j)=>[esc(j),code(M.tacText(i)),esc(loc(i.span))]):empty('Correct the errors before generating intermediate code.');
      case 7:return c.target?'<div class="summary-line">'+stat(c.target.length+' target instructions')+stat('Register-based VM')+'</div>'+targetTable():empty('Target code is unavailable.');
      case 8:return vm?runtime():empty('Compile successfully to create the virtual machine.');
      case 9:return vm?'<div class="summary-line">'+stat(vm.state.output.length+' output line(s)')+stat(vm.state.halted?(vm.state.error?'Runtime error':'Execution complete'):'Execution not finished')+'</div>'+consoleOutput()+'<div class="notice">'+(vm.state.error?esc(vm.state.error.message):vm.state.halted?'The VM reached HALT. Reset execution to replay this program.':'Use Step instruction or Run below. Compilation alone does not produce output.')+'</div>':empty('Output is available after successful compilation and execution.');
    }
  }
  function maxPhase(){return !compilation?0:compilation.failedPhase==='Lexical Analysis'?1:compilation.failedPhase==='Syntax Analysis'?2:compilation.failedPhase?5:9;}
  function failIndex(){return compilation?.failedPhase?M.phases.indexOf(compilation.failedPhase):vm?.state.error?8:-1;}
  function renderDiagnostics(){
    const diagnostics=[...(compilation?.diagnostics||[]),...(vm?.state.error?[vm.state.error]:[])];
    $('diagnostics').innerHTML=diagnostics.map((d,i)=>`<div class="diagnostic"><strong>${esc(d.phase)}</strong><br><button data-diagnostic="${i}">Line ${d.span.line}, column ${d.span.column}: ${esc(d.message)}</button></div>`).join('');
    $('diagnostics').querySelectorAll('[data-diagnostic]').forEach(b=>b.onclick=()=>{const d=diagnostics[+b.dataset.diagnostic];source.focus();source.setSelectionRange(d.span.start,Math.max(d.span.start+1,d.span.end));source.scrollTop=Math.max(0,(d.span.line-3)*23);position();});
  }
  function render(){
    const failed=failIndex();
    $('phases').innerHTML=M.phases.map((p,i)=>`<button class="phase-button ${phase===i?'active':''} ${failed===i?'failed':''}" data-phase="${i}" ${i>revealed?'disabled':''} ${phase===i?'aria-current="step"':''}><span class="num">${String(i+1).padStart(2,'0')}</span><span>${esc(p)}</span><span class="stage-check">${failed===i?'!':i<=revealed?'✓':''}</span></button>`).join('');
    $('progress-label').textContent=`${revealed+1} / 10 stages available`;
    $('phase-number').textContent=String(phase+1).padStart(2,'0');$('phase-title').textContent=M.phases[phase];$('phase-kicker').textContent=phase===0?'START HERE':phase<8?'INSIDE THE COMPILER':'INSIDE THE VIRTUAL MACHINE';$('phase-description').textContent=descriptions[phase];
    $('artifact-status').textContent=phase===0?'Editable':failed===phase?'Failed':phase<8?'Inspectable':vm?.state.halted?'Finished':'Ready';
    $('artifact').innerHTML=artifact();
    $('phases').querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{phase=+b.dataset.phase;render();});
    $('artifact').querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{pages[b.dataset.page]=(pages[b.dataset.page]||0)+Number(b.dataset.delta);render();});
    $('next-phase').disabled=!!compilation&&revealed>=maxPhase();
    const ready=!!vm&&revealed>=7;
    $('step').disabled=!ready||vm.state.halted;$('run').disabled=!ready||vm.state.halted;$('reset').disabled=!ready;
    $('runtime-status').textContent=!ready?'Compile your program to begin execution.':vm.state.error?`Stopped at PC ${vm.state.pc} · ${vm.state.steps} instructions executed`:vm.state.halted?`Halted · ${vm.state.steps} instructions · ${vm.state.output.length} output line(s)`:`PC ${vm.state.pc} · ${vm.state.steps} instructions executed · ready to step`;
    $('global-status').textContent=failed>=0?'Error in '+M.phases[failed]:vm?.state.halted?'Execution complete':compilation?'Compilation successful':'Ready to explore';$('global-status').classList.toggle('error',failed>=0);
    renderDiagnostics();
  }
  function invalidate(){compilation=null;vm=null;phase=0;revealed=0;for(const k in pages)delete pages[k];render();}
  function lines(){$('line-numbers').textContent=source.value.split('\n').map((_,i)=>i+1).join('\n');}
  function position(){const before=source.value.slice(0,source.selectionStart),parts=before.split('\n');$('source-position').textContent=`Ln ${parts.length}, Col ${parts.at(-1).length+1}`;}
  function build(){compilation=M.compile(source.value);vm=compilation.target?M.createVM(compilation.target):null;}
  function loadExample(i){source.value=M.examples[i].source;$('example-description').textContent=M.examples[i].description;lines();position();invalidate();}
  $('example').innerHTML=M.examples.map((e,i)=>`<option value="${i}">${esc(e.name)}</option>`).join('');
  $('example').onchange=e=>loadExample(+e.target.value);
  source.addEventListener('input',()=>{lines();position();invalidate();$('example-description').textContent='Custom program · edit, compile, and explore.';});
  source.addEventListener('click',position);source.addEventListener('keyup',position);source.addEventListener('scroll',()=>{$('line-numbers').scrollTop=source.scrollTop;});
  source.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();source.setRangeText('    ',source.selectionStart,source.selectionEnd,'end');source.dispatchEvent(new Event('input'));}});
  $('compile').onclick=()=>{build();revealed=maxPhase();phase=compilation.failedPhase?Math.min(maxPhase(),M.phases.indexOf(compilation.failedPhase)):7;render();};
  $('next-phase').onclick=()=>{if(!compilation)build();revealed=Math.min(revealed+1,maxPhase());phase=revealed;render();};
  function execute(all){if(!vm)return;if(all)vm.run();else vm.step();revealed=9;phase=8;pages.target=Math.floor(Math.min(vm.state.pc,compilation.target.length-1)/100);pages.history=Math.floor(Math.max(0,vm.history.length-1)/100);const span=vm.history.at(-1)?.span;if(span){source.setSelectionRange(span.start,span.end);source.scrollTop=Math.max(0,(span.line-4)*23);}render();}
  $('step').onclick=()=>execute(false);$('run').onclick=()=>execute(true);
  $('reset').onclick=()=>{if(vm){vm.reset();pages.target=0;pages.history=0;phase=8;render();}};
  $('download').onclick=()=>{const u=URL.createObjectURL(new Blob([source.value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='program.mini';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  loadExample(0);
})(globalThis.MiniLang);

