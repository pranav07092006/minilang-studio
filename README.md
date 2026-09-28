# MiniLang Studio

MiniLang Studio is a self-contained educational compiler explorer. It turns a MiniLang source program into tokens, a syntax tree, a symbol table, typed intermediate code, target instructions, and finally virtual-machine output. Each phase is real compiler output, not a prepared illustration.

## Open the application

Open `index.html` in a modern browser. No installation, account, server, or internet connection is required. Select an example or write a program, then use **Next phase** to reveal the stages one at a time. **Compile all** prepares every compiler artifact without executing the program. Use **Step instruction** or **Run** in the virtual-machine controls to execute the generated target code.

For a local server during development, run:

```powershell
node ../work/preview.cjs .
```

Then visit `http://127.0.0.1:4173`.

## The ten visible stages

1. Source Program
2. Lexical Analysis
3. Syntax Analysis
4. Abstract Syntax Tree
5. Symbol Table
6. Semantic Analysis
7. Intermediate Code
8. Target Code
9. Execution
10. Output

## MiniLang at a glance

```text
begin
    let count : int = 5;
    let price : real = 12.5;
    let total : real = count * price;

    when (total > 50.0) {
        show("Large order");
    } otherwise {
        show("Small order");
    }
    show(total);
end
```

Types are `int`, `real`, `bool`, and `text`. Statements are declarations, assignments, `when`/`otherwise` conditionals, and `show` output. The language supports arithmetic, comparison, equality, unary operators, text concatenation, and short-circuit `&&` / `||`.

Variables must be declared before they are used. Scopes are introduced by conditional blocks; names cannot shadow an active outer declaration. `int` values may widen to `real`, but real-to-integer conversion is rejected.

## Tests

The automated suite uses only the Node.js built-in test runner:

```powershell
node --test tests/compiler.test.cjs
```

The current suite has 58 passing tests. It covers scanning, positions, grammar, scope, types, code generation, control flow, short-circuiting, virtual-machine state, runtime errors, limits, and preservation of earlier artifacts after a failure.

## Files

- `src/lexer.js` — scanner and lexical trace
- `src/parser.js` — recursive-descent parser and AST
- `src/semantic.js` — scopes, symbols, types, and semantic trace
- `src/ir.js` — three-address code generator
- `src/target.js` — register instruction generator
- `src/vm.js` — target-code virtual machine
- `src/pipeline.js` — phase orchestration
- `src/app.js` — interactive interface
- `report.html` / `report.md` — project report

## Limits

To keep the browser responsive, a program is limited to 50,000 source characters, 128 parser/AST nesting levels, 20,000 trace events per phase, 50,000 executed VM instructions, and 1,000,000 characters in a runtime text result. Each limit produces a compiler or execution diagnostic with a source position.


