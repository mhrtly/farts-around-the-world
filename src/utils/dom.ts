type DomChild = HTMLElement | SVGElement | string | number | null | undefined | DomChild[];

interface DomProps {
  className?: string;
  id?: string;
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
  innerHTML?: string;
  textContent?: string;
  [key: string]: any;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: DomProps | null,
  ...children: DomChild[]
): HTMLElementTagNameMap[K];
export function h(
  tag: string,
  props?: DomProps | null,
  ...children: DomChild[]
): HTMLElement;
export function h(tag: string, props?: DomProps | null, ...children: DomChild[]): HTMLElement {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  appendChildren(el, children);
  return el;
}

function applyProps(el: HTMLElement, props: DomProps): void {
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'className') {
      el.className = value as string;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'innerHTML') {
      el.innerHTML = value as string;
    } else if (key === 'textContent') {
      el.textContent = value as string;
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

function appendChildren(el: HTMLElement, children: DomChild[]): void {
  for (const child of children) {
    if (child == null) continue;
    if (Array.isArray(child)) {
      appendChildren(el, child);
    } else if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else {
      el.appendChild(child);
    }
  }
}

export function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function replaceChildren(el: HTMLElement, ...children: DomChild[]): void {
  clearChildren(el);
  appendChildren(el, children);
}
