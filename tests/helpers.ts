import type { Logger } from '../src/application/ports';
import { createEmptyDocument, type ElementType, type UiDocument, type UiElement } from '../src/domain/model';
import { createElement, type IdGenerator } from '../src/domain/tree';

/** Deterministic ids: id-1, id-2... */
export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

export function el(
  type: ElementType,
  id: string,
  rect: { x: number; y: number; width: number; height: number },
  children: UiElement[] = [],
  patch: Partial<UiElement> = {},
): UiElement {
  return { ...createElement(type, rect, id, id), children, ...patch };
}

export function docWith(...elements: UiElement[]): UiDocument {
  return { ...createEmptyDocument('Test'), elements };
}
