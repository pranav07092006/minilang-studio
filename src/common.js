(function (M) {
  'use strict';
  M.limits = Object.freeze({source:50000, depth:128, trace:20000, steps:50000, text:1000000});
  M.CompilationError = class extends Error {
    constructor(phase, message, span, partial = {}) {
      super(message); this.diagnostic = {phase, message, span}; this.partial = partial;
    }
  };
  M.fail = (phase, message, span, partial) => { throw new M.CompilationError(phase, message, span, partial); };
  M.trace = (list, phase, action, detail, span) => {
    if (list.length >= M.limits.trace) M.fail(phase, 'Trace limit exceeded (20,000 events). Use a smaller program.', span);
    list.push({action, detail, span});
  };
  M.format = value => typeof value === 'string' ? JSON.stringify(value) : String(value);
})(globalThis.MiniLang = globalThis.MiniLang || {});

