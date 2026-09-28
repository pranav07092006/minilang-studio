(function(M){
  M.examples=[
    {name:'01 · Order calculator',description:'Declarations, arithmetic, branching, and output.',source:`begin
    // A small program. Every stage, explained.
    let count : int = 5;
    let price : real = 12.5;
    let total : real = count * price;

    when (total > 50.0) {
        show("Large order");
    } otherwise {
        show("Small order");
    }

    show(total);
end`},
    {name:'02 · Arithmetic & types',description:'Operator precedence, widening, and text.',source:`begin
    let score : int = 2 + 3 * 4;
    let average : real = score / 4;
    let title : text = "Mini" + "Lang";
    show(title);
    show(score);
    show(average);
    show(-5 % 2);
end`},
    {name:'03 · Conditions & scope',description:'Only the chosen branch creates runtime values.',source:`begin
    let passed : bool = false;
    when (passed) {
        let message : text = "Passed";
        show(message);
    } otherwise {
        let message : text = "Try again";
        show(message);
    }
end`},
    {name:'04 · Short-circuit logic',description:'Skipped operands never divide by zero.',source:`begin
    let safe : bool = false && (10 / 0 > 1);
    let ready : bool = true || (10 / 0 > 1);
    show(safe);
    show(ready);
end`},
    {name:'05 · Lexical error',description:'An unsupported character stops tokenization.',source:`begin
    let count : int = 5 @ 2;
    show(count);
end`},
    {name:'06 · Syntax error',description:'A missing semicolon stops parsing.',source:`begin
    let count : int = 5
    show(count);
end`},
    {name:'07 · Semantic errors',description:'Types, duplicate declarations, and unknown names.',source:`begin
    let count : int = 2.5;
    let count : int = 3;
    show(missing);
end`},
    {name:'08 · Runtime error',description:'Compilation succeeds; the VM catches division by zero.',source:`begin
    show("Execution started");
    let divisor : int = 0;
    show(10 / divisor);
end`}
  ];
  M.phases=['Source Program','Lexical Analysis','Syntax Analysis','Abstract Syntax Tree','Symbol Table','Semantic Analysis','Intermediate Code','Target Code','Execution','Output'];
})(globalThis.MiniLang);

