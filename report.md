# MiniLang Studio: Mini Compiler for a Simple Programming Language

## Abstract

MiniLang Studio is an educational compiler project that makes compilation observable. It implements a custom language named MiniLang and displays each stage from editable source code through lexical analysis, parsing, AST construction, symbol-table creation, semantic analysis, intermediate-code generation, target-code generation, virtual-machine execution, and output. The system is a local browser application with no backend. The compiler is handwritten rather than relying on a parser generator, so each major compiler decision remains inspectable.

## Objectives

- Demonstrate the standard compiler flow in one working system.
- Define an original small language with clear syntax and semantic rules.
- Generate actual tokens, tree nodes, symbols, intermediate instructions, target instructions, and output for the user’s program.
- Report lexical, syntax, semantic, and runtime errors with line and column information.
- Let students execute generated instructions one at a time and inspect state changes.

## System requirements

The application opens in a modern browser and requires no installation. Node.js is required only for the included automated tests. The implementation uses HTML, CSS, and vanilla JavaScript; it does not use `eval`, external libraries, a database, or a server.

## MiniLang language specification

### Lexical rules

Keywords are case-sensitive: `begin`, `end`, `let`, `int`, `real`, `bool`, `text`, `when`, `otherwise`, `show`, `true`, and `false`. Identifiers begin with a letter or underscore and may continue with letters, digits, or underscores. Comments begin with `//`. Text literals use double quotes and support `\\n`, `\\t`, `\\"`, and `\\\\`. Numeric literals are decimal integer or real literals.

### EBNF grammar

```text
program     = "begin" { statement } "end" EOF ;
statement   = declaration | assignment | conditional | output ;
declaration = "let" identifier ":" type "=" expression ";" ;
assignment  = identifier "=" expression ";" ;
conditional = "when" "(" expression ")" block [ "otherwise" block ] ;
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
primary     = literal | identifier | "(" expression ")" ;
```

### Type and scope rules

The supported types are `int`, `real`, `bool`, and `text`. Arithmetic accepts only numeric operands. `/` produces a real number; `%` requires integers. `+` also concatenates two text values. Comparisons use numbers; equality accepts identical types or an integer/real pair. Conditions and logical operators require `bool`. An `int` may widen to `real`; narrowing and other incompatible assignments are errors.

Each block introduces lexical scope. A variable must be declared before use. Duplicate declarations and shadowing of an active outer variable are rejected. Declarations from completed sibling blocks may reuse the same name, but receive different symbol IDs and storage locations.

## Architecture and compilation flow

```text
Source Program
      ↓
Lexical Analysis → Token table + scanner trace
      ↓
Syntax Analysis → Parser trace
      ↓
Abstract Syntax Tree
      ↓
Symbol Table
      ↓
Semantic Analysis → Typed AST + diagnostics
      ↓
Intermediate Code → Three-address code
      ↓
Target Code → Register instructions
      ↓
Execution → VM state and history
      ↓
Output
```

The lexer scans the source with maximal matching for two-character operators. It stores offsets, one-based line/column positions, decoded literal values, and a scanner trace. The parser is a recursive-descent parser with precedence functions from `or` through `primary`. It produces source-spanned AST nodes and records the grammar productions and tokens consumed.

The semantic analyzer maintains a stack of scopes. It adds a unique symbol record for each declaration, resolves each name to that record, annotates expressions with types, and records allowed integer widening. It collects independent semantic errors where possible and stops later generation when errors exist.

The IR generator lowers a typed AST to three-address code with temporaries and labels. Boolean short-circuiting is preserved by branches rather than evaluating both operands. The target generator then lowers that representation to loads, stores, arithmetic/comparison instructions, casts, branches, print, and halt. Labels are resolved into instruction addresses.

The virtual machine executes only target instructions. It owns an instruction pointer, registers, symbol-ID-keyed memory, output, a halt/error state, and a history entry for every instruction. Every entry captures state changes, output additions, source position, and the next instruction pointer.

## Worked example

Input:

```text
begin
    let count : int = 5;
    let price : real = 12.5;
    let total : real = count * price;
    show(total);
end
```

Representative tokens include `begin`, `let`, identifier `count`, delimiter `:`, keyword `int`, operator `=`, integer `5`, and delimiter `;`. The AST has a Program node containing three Declare nodes and one Show node. The symbol table has `s0` for `count:int`, `s1` for `price:real`, and `s2` for `total:real`.

Representative three-address code:

```text
s0 = 5
s1 = 12.5
t0 = s0
t1 = real(t0)
t2 = t1 * s1
s2 = t2
print s2
halt
```

Target instructions load constants into registers, store them under `s0` and `s1`, load and cast `s0`, multiply it by `s1`, store `s2`, print it, and halt. The resulting output is `62.5`. The application displays each generated instruction and every register/memory change during execution.

## Error handling and safeguards

All diagnostics include the phase, message, and source position. A lexical or syntax error retains the partial trace created before failure. Semantic errors retain the AST, symbol table, and semantic trace, while code generation remains unavailable. Runtime errors retain output and execution history from instructions that completed earlier.

The application enforces limits of 50,000 source characters, 128 nesting levels, 20,000 trace events per phase, 50,000 VM instructions, and 1,000,000 characters in a text result. These limits prevent malformed programs from freezing the browser.

## Verification

Automated verification was run with `node --test tests/compiler.test.cjs`. Result: **58 tests passed, 0 failed**. The suite verifies token source positions and escapes; precedence and grammar errors; scopes, typing, declarations, and conversion; three-address and target provenance; both conditional paths; short-circuiting; correct VM output; divide-by-zero and overflow errors; instruction limits; reset; and equality of full execution versus stepping.

Manual browser verification covers the ten labels and their sequence, separate phase reveal, compilation without execution, target-instruction stepping, execution history, output, errors, reset, example loading, AST disclosure, source invalidation after edits, literal HTML-safe display, and narrow-screen layout.

## Limitations and future scope

MiniLang v1 intentionally excludes loops, functions, input, arrays, optimization, implicit conversions other than int-to-real, and persistent programs. Future versions can add those features, a control-flow graph, optimization passes, breakpoints, file import/export, and an instructional quiz mode.

## Conclusion

MiniLang Studio meets the project objective by combining compiler-design concepts in a working, inspectable application. Its custom language, handwritten compiler phases, source-linked diagnostics, generated target code, and step-by-step virtual machine make the internal translation of a program visible from source through output.

