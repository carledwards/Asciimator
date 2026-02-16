export interface CellAttributes {
  foreground: number;
  background: number;
}

export interface Cell {
  char: string;
  attributes: CellAttributes;
}

/** null = transparent (shows layer below) */
export type LayerCell = Cell | null;

export interface Position {
  x: number;
  y: number;
}

export interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  cells: LayerCell[][];
  groupId?: string;
}

export interface LayerGroupData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  collapsed: boolean;
  order?: number;
  kind?: 'layer' | 'animation';
}

export interface DocumentData {
  width: number;
  height: number;
  layers: LayerData[];
  activeLayerId: string;
  groups?: LayerGroupData[];
}

export interface InputModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface MouseEventData {
  position: Position;
  isButtonDown: boolean;
  modifiers: InputModifiers;
}

export interface KeyEventData {
  key: string;
  modifiers: InputModifiers;
}

export const DEFAULT_ATTRIBUTES: CellAttributes = {
  foreground: 15,
  background: 0,
};

export const DEFAULT_CHAR = ' ';
