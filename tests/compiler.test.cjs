const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
globalThis.MiniLang = {};
for (const name of ['common','lexer','parser','semantic','ir','target','vm','pipeline']) {
  const file = path.join(__dirname, '../src', name + '.js');
  if (fs.existsSync(file)) require(file);
}
const M = globalThis.MiniLang;
const parse = s => M.parse(M.lex(s).tokens).ast;
const program = s => `begin\n${s}\nend`;
test('CRLF source positions and escaped text are preserved', () => {
  assert.equal(typeof M.lex, 'function');
  const r = M.lex('begin\r\nshow("a\\n");\r\nend');
  const t = r.tokens.find(t => t.lexeme === 'show');
  assert.equal(t.span.line, 2); assert.equal(t.span.column, 1);
  assert.equal(r.tokens.find(t => t.kind === 'TEXT').value, 'a\n');
});
test('multiplication binds more tightly than addition', () => {
  const e = parse(program('show(2 + 3 * 4);')).statements[0].expression;
  assert.equal(e.operator, '+'); assert.equal(e.right.operator, '*');
});
test('parentheses override precedence and subtraction associates left', () => {
  const e = parse(program('show((2 + 3) * 4 - 1 - 2);')).statements[0].expression;
  assert.equal(e.left.operator, '-'); assert.equal(e.left.left.left.operator, '+');
});
test('comment skipping is visible in lexer trace', () => {
  const r = M.lex('begin // note\nend');
  assert.deepEqual(r.tokens.map(t => t.lexeme), ['begin','end','']);
  assert.ok(r.trace.some(t => t.action === 'Skip comment'));
});
test('empty program is valid', () => assert.equal(parse('begin end').statements.length, 0));
for (const [label, source, phase] of [
  ['unknown character','begin @ end','Lexical Analysis'],
  ['unterminated string','begin show("oops); end','Lexical Analysis'],
  ['invalid escape','begin show("\\q"); end','Lexical Analysis'],
  ['missing semicolon','begin show(1) end','Syntax Analysis'],
  ['trailing input','begin end show(1);','Syntax Analysis'],
  ['unclosed block','begin when(true) { show(1); end','Syntax Analysis']
]) test(label + ' has positioned diagnostic', () => {
  assert.throws(() => parse(source), e => e.diagnostic?.phase === phase && e.diagnostic.span.column > 0);
});
test('excessively nested expressions fail with a diagnostic', () => {
  assert.throws(() => parse(program('show(' + '('.repeat(150) + '1' + ')'.repeat(150) + ');')), e => e.diagnostic?.phase === 'Syntax Analysis');
});
test('long left associative chains fail before later AST traversal overflows', () => {
  assert.throws(() => parse(program('show(' + Array(150).fill('1').join('+') + ');')), e => e.diagnostic?.phase === 'Syntax Analysis');
});
test('source-size limit is a positioned diagnostic', () => {
  assert.throws(() => M.lex(' '.repeat(50001)), e => e.diagnostic?.phase === 'Lexical Analysis');
});
const analyze = s => M.analyze(parse(program(s)));
for (const [label,source] of [
  ['widening','let x : real = 3;'],
  ['text concatenation','let s : text = "a" + "b"; show(s);'],
  ['boolean operators','let b : bool = true && !false || false; when(b) { show(1); }'],
  ['all numeric operators','show(-1 + 2 * 3 / 4); show(5 % 2); show(2 >= 1);']
]) test('semantic success: '+label,()=>assert.deepEqual(analyze(source).diagnostics,[]));
for(const [label,source] of [
  ['narrowing','let x : int = 1.5;'],
  ['duplicate','let x : int = 1; let x : int = 2;'],
  ['shadowing','let x : int = 1; when(true) { let x : int = 2; }'],
  ['undeclared','show(missing);'],
  ['self initializer','let x : int = x;'],
  ['condition type','when(1) { show(1); }'],
  ['bool arithmetic','show(true + 1);'],
  ['text arithmetic','show("a" * 2);'],
  ['invalid remainder','show(2.5 % 2);'],
  ['out of scope','when(true) { let x : int = 1; } show(x);'],
  ['assignment mismatch','let x : int = 1; x = false;']
]) test('semantic rejection: '+label,()=>{
  const d=analyze(source).diagnostics;assert.ok(d.length);assert.equal(d[0].phase,'Semantic Analysis');assert.ok(d[0].span.line>0);
});
test('sibling scopes use distinct symbol storage identities',()=>{
  const a=analyze('when(true) { let x : int = 1; } when(true) { let x : int = 2; }');
  assert.deepEqual(a.diagnostics,[]);assert.equal(a.symbols.length,2);assert.notEqual(a.symbols[0].id,a.symbols[1].id);
});
test('independent semantic errors accumulate without cascades',()=>{
  const a=analyze('show(a + 1); show(b);');assert.equal(a.diagnostics.length,2);
});
const compile = body => M.compile(program(body));
function execute(body){const c=compile(body);assert.deepEqual(c.diagnostics,[]);const vm=M.createVM(c.target);vm.run();return {c,vm};}
for(const [label,body,expected] of [
  ['precedence','show(2 + 3 * 4);',['14']],
  ['real division','show(5 / 2);',['2.5']],
  ['true branch','when(true) { show("yes"); } otherwise { show("no"); }',['yes']],
  ['false branch','when(false) { show("yes"); } otherwise { show("no"); }',['no']],
  ['false and short circuit','show(false && (1 / 0 > 1));',['false']],
  ['true or short circuit','show(true || (1 / 0 > 1));',['true']],
  ['true and evaluation','show(true && (3 > 2));',['true']],
  ['false or evaluation','show(false || (3 < 2));',['false']],
  ['sibling storage','when(true) { let x : int = 1; show(x); } when(true) { let x : int = 2; show(x); }',['1','2']],
  ['assignment and widening','let x : real = 2; x = x + 1; show(x);',['3']],
  ['unary remainder','show(-5 % 2); show(+2); show(!false);',['-1','2','true']],
  ['comparisons','show(1 < 2); show(2 <= 2); show(3 > 2); show(3 >= 4); show(1 == 1.0); show(1 != 2);',['true','true','true','false','true','true']],
  ['text concat and equality','show("mini" + "lang"); show("a" == "a");',['minilang','true']],
  ['dangerous untaken branch','when(false) { show(1 / 0); } show("safe");',['safe']],
  ['nested short circuit','show((false || true) && (true || (1 / 0 > 1)));',['true']],
  ['empty program','',[]]
]) test('VM output: '+label,()=>{const {vm}=execute(body);assert.equal(vm.state.error,null);assert.deepEqual(vm.state.output,expected);assert.equal(vm.state.halted,true);});
for(const [label,body] of [
  ['divide zero','show(1 / 0);'],['remainder zero','show(2 % 0);'],
  ['integer overflow','show(9007199254740991 + 1);'],
  ['nonfinite real','let x : real = 10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000.0; show(x*x);']
]) test('VM runtime diagnostic: '+label,()=>{const {vm}=execute(body);assert.ok(vm.state.error);assert.equal(vm.state.error.phase,'Execution');assert.ok(vm.state.error.span.line>0);});
test('step and run produce identical execution, history, and reset',()=>{
  const c=compile('let x : int = 2; x = x * 3; show(x);');assert.deepEqual(c.diagnostics,[]);
  const a=M.createVM(c.target),b=M.createVM(c.target);a.run();while(!b.state.halted)b.step();
  assert.deepEqual(a.state,b.state);assert.deepEqual(a.history,b.history);assert.equal(b.state.output[0],'6');
  b.reset();assert.equal(b.state.pc,0);assert.deepEqual(b.state.output,[]);assert.equal(b.history.length,0);assert.deepEqual(b.state.memory,{});
});
test('target instructions retain TAC and source provenance',()=>{
  const c=compile('show(2 + 3);');assert.deepEqual(c.diagnostics,[]);
  assert.ok(c.target.length>c.tac.length);assert.ok(c.target.every(t=>t.span.line>0&&c.tac[t.tacIndex]));
});
test('VM respects target instructions rather than source evaluation',()=>{
  const c=compile('show(7);');const load=c.target.find(t=>t.op==='LOAD_CONST');load.args[1]=42;
  const vm=M.createVM(c.target);vm.run();assert.deepEqual(vm.state.output,['42']);
});
test('failed compilation preserves earlier artifacts and prevents code generation',()=>{
  const c=compile('show(missing);');assert.ok(c.tokens.length);assert.ok(c.ast);assert.ok(c.diagnostics.length);assert.equal(c.target,null);
  const p=M.compile('begin show(1) end');assert.ok(p.parserTrace.length);assert.ok(p.tokens.length);assert.equal(p.ast,null);
  const l=M.compile('begin @ end');assert.equal(l.tokens[0].lexeme,'begin');assert.ok(l.lexicalTrace.length);
});
test('runtime failure keeps previous output and failed step',()=>{
  const {vm}=execute('show("before"); show(1/0);');assert.deepEqual(vm.state.output,['before']);assert.ok(vm.history.at(-1).error);
});
test('VM instruction budget stops a target-code cycle',()=>{
  const vm=M.createVM([{op:'JUMP',args:[0],span:{line:1,column:1,start:0,end:1},tacIndex:0}]);vm.run();assert.ok(vm.state.error);assert.equal(vm.state.steps,50000);
});
test('lexer trace limit reports failure and preserves partial tokens',()=>{
  const c=M.compile('begin '+ '1 '.repeat(11000)+'end');assert.equal(c.failedPhase,'Lexical Analysis');assert.ok(c.tokens.length);assert.match(c.diagnostics[0].message,/Trace limit/);
});

