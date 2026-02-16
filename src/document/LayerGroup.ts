import { LayerGroupData } from '../core/types';

let nextGroupId = 1;

export class LayerGroup {
  readonly id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  collapsed: boolean;
  order: number;
  kind: 'layer' | 'animation';

  constructor(name?: string, options?: { order?: number; kind?: 'layer' | 'animation' }) {
    this.id = `group_${nextGroupId++}`;
    this.name = name ?? 'Group';
    this.visible = true;
    this.locked = false;
    this.collapsed = false;
    this.order = options?.order ?? 0;
    this.kind = options?.kind ?? 'layer';
  }

  toData(): LayerGroupData {
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      locked: this.locked,
      collapsed: this.collapsed,
      order: this.order,
      kind: this.kind,
    };
  }

  static fromData(data: LayerGroupData): LayerGroup {
    const group = new LayerGroup(data.name, {
      order: data.order ?? 0,
      kind: data.kind ?? 'layer',
    });
    (group as { id: string }).id = data.id;
    group.visible = data.visible;
    group.locked = data.locked;
    group.collapsed = data.collapsed;
    group.order = data.order ?? group.order;
    group.kind = data.kind ?? group.kind;
    return group;
  }
}
