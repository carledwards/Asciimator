import { InputModifiers } from '../core/types';
import { eventBus, Events } from '../core/EventBus';

export class KeyboardService {
  private modifiers: InputModifiers = { ctrl: false, alt: false, shift: false, meta: false };

  constructor() {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.modifiers = {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
    };

    eventBus.emit(Events.KEY_DOWN, {
      key: e.key,
      code: e.code,
      modifiers: { ...this.modifiers },
      preventDefault: () => e.preventDefault(),
      raw: e,
    });
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.modifiers = {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
    };

    eventBus.emit(Events.KEY_UP, {
      key: e.key,
      code: e.code,
      modifiers: { ...this.modifiers },
    });
  };

  getModifiers(): InputModifiers {
    return { ...this.modifiers };
  }

  cleanup(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }
}
