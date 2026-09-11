// router.js — the smallest possible view router. Dependency-free so every
// module can call go() without creating an import cycle.

export const view = { name: 'home', p: {} };
const stack = [];
let renderer = () => {};

export function setRenderer(fn) { renderer = fn; }

export function go(name, p = {}) {
  if (view.name !== name || JSON.stringify(view.p) !== JSON.stringify(p)) {
    stack.push({ name: view.name, p: view.p });
    if (stack.length > 30) stack.shift();
  }
  view.name = name;
  view.p = p;
  renderer();
}

export function back(fallback = 'home') {
  const prev = stack.pop();
  view.name = prev ? prev.name : fallback;
  view.p = prev ? prev.p : {};
  renderer();
}

export function replace(name, p = {}) {
  view.name = name;
  view.p = p;
  renderer();
}

export function render() { renderer(); }
