export function add(a: number, b: number): number {
  return a + b;
}

export function score(n: number): number {
  if (n > 0 && n < 10) {
    return n ? 1 : 0;
  }
  switch (n) {
    case 1:
      return 1;
    default:
      return 0;
  }
}

export const parse = (s: string): number => {
  try {
    return s ? Number(s) : 0;
  } catch {
    return 0;
  }
};

export default function (x: boolean) {
  return x || false;
}

interface SkipMe {
  method(): void;
}

export class Box {
  constructor(private x: number) {}

  get value() {
    return this.x;
  }

  static empty() {
    return new Box(0);
  }

  #secret() {
    return this.x;
  }

  map(fn: (n: number) => number) {
    return fn(this.x > 0 ? this.x : 0);
  }

  field = () => this.x ?? 0;
}

export const api = {
  ping() {
    return true;
  },
};

function overloads(x: string): string;
function overloads(x: number): number;
function overloads(x: string | number): string | number {
  return x;
}

declare function ambient(): void;

export function withMap(xs: number[]) {
  return xs.map((x) => (x ? 1 : 0));
}
