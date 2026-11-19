/**
 * Project file format (.uidesign): pretty-printed JSON of the document model.
 * Parsing is defensive: unknown fields are dropped, missing fields get defaults,
 * so files written by older versions keep opening.
 */
import type { DocumentSerializer } from '../../application/ports';
import { defaultPropsFor, defaultStyleFor, isElementType } from '../../domain/catalog';
import {
  BACKGROUND_FITS,
  BOX_TAGS,
  createEmptyDocument,
  DOCUMENT_FORMAT_VERSION,
  type CanvasSettings,
  type ElementProps,
  type ElementStyle,
  type UiDocument,
  type UiElement,
} from '../../domain/model';
import { randomId } from '../../domain/tree';

export const PROJECT_FORMAT = 'ui-designer-project';

export class ProjectFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFormatError';
  }
}

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Copies the known keys of `defaults` from `raw`, keeping each value's type. */
function mergeTyped<T extends object>(defaults: T, raw: unknown): T {
  if (!isObject(raw)) return defaults;
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [key, def] of Object.entries(defaults)) {
    const v = raw[key];
    if (Array.isArray(def)) out[key] = Array.isArray(v) ? v.filter((x) => typeof x === 'string') : def;
    else if (typeof def === 'number') out[key] = num(v, def);
    else if (typeof def === 'boolean') out[key] = bool(v, def);
    else if (typeof def === 'string') out[key] = str(v, def);
  }
  return out as T;
}

/** Keeps `value` only when it is one of the allowed values. */
function oneOf<T extends string>(value: T, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value) ? value : fallback;
}

export class JsonProjectSerializer implements DocumentSerializer {
  serialize(doc: UiDocument): string {
    return JSON.stringify({ format: PROJECT_FORMAT, ...doc, version: DOCUMENT_FORMAT_VERSION }, null, 2) + '\n';
  }

  parse(text: string): UiDocument {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      throw new ProjectFormatError(`Fichier JSON invalide : ${(err as Error).message}`);
    }
    if (!isObject(raw) || raw['format'] !== PROJECT_FORMAT) {
      throw new ProjectFormatError('Ce fichier n’est pas un projet UI Designer.');
    }
    const version = num(raw['version'], 0);
    if (version > DOCUMENT_FORMAT_VERSION) {
      throw new ProjectFormatError(
        `Ce projet a été créé par une version plus récente (format ${version}, supporté : ${DOCUMENT_FORMAT_VERSION}).`,
      );
    }
    const base = createEmptyDocument();
    const ids = new Set<string>();
    const canvasRaw = mergeTyped(base.canvas, raw['canvas']);
    const canvas: CanvasSettings = {
      ...canvasRaw,
      // Format 1 had no screen height: the page was exactly one screen.
      viewportHeight: version < 2 ? canvasRaw.height : Math.max(16, canvasRaw.viewportHeight),
      backgroundFit: oneOf(canvasRaw.backgroundFit, BACKGROUND_FITS, 'cover'),
    };
    return {
      version: DOCUMENT_FORMAT_VERSION,
      name: str(raw['name'], base.name),
      canvas,
      grid: mergeTyped(base.grid, raw['grid']),
      elements: this.parseElements(raw['elements'], ids),
    };
  }

  private parseElements(raw: unknown, ids: Set<string>): UiElement[] {
    if (!Array.isArray(raw)) return [];
    const out: UiElement[] = [];
    for (const item of raw) {
      if (!isObject(item) || !isElementType(item['type'])) continue;
      const type = item['type'];
      let id = str(item['id'], '');
      if (!id || ids.has(id)) id = randomId();
      ids.add(id);
      const styleRaw: ElementStyle = mergeTyped(defaultStyleFor(type), item['style']);
      const style: ElementStyle = { ...styleRaw, backgroundFit: oneOf(styleRaw.backgroundFit, BACKGROUND_FITS, 'cover') };
      const propsRaw: ElementProps = mergeTyped(defaultPropsFor(type), item['props']);
      const props: ElementProps = { ...propsRaw, boxTag: oneOf(propsRaw.boxTag, BOX_TAGS, 'div') };
      out.push({
        id,
        type,
        name: str(item['name'], id),
        x: num(item['x'], 0),
        y: num(item['y'], 0),
        width: Math.max(1, num(item['width'], 100)),
        height: Math.max(1, num(item['height'], 100)),
        hidden: bool(item['hidden'], false),
        locked: bool(item['locked'], false),
        fixed: bool(item['fixed'], false),
        cssClass: str(item['cssClass'], ''),
        style,
        props,
        children: type === 'container' ? this.parseElements(item['children'], ids) : [],
      });
    }
    return out;
  }
}
