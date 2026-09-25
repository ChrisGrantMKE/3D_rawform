import type { App } from '../App';
import type { ProjectState } from '../state/ProjectState';
import type { SceneManager } from '../engine/SceneManager';
import type { StrokeRenderer } from '../engine/StrokeRenderer';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import type { Toolbar } from '../ui/Toolbar';

export interface PluginContext {
  app: App;
  state: ProjectState;
  sceneManager: SceneManager;
  renderer: StrokeRenderer;
  undoManager: UndoRedoManager;
  toolbar: Toolbar;
  uiLayer: HTMLElement;
}

export interface RawformPlugin {
  /** Unique identifier for the plugin */
  id: string;
  /** Human-readable name */
  name: string;
  /** Plugin version */
  version: string;
  
  /** Called when the plugin is loaded and enabled */
  onEnable(context: PluginContext): void;
  
  /** Called when the plugin is disabled or unloaded */
  onDisable(): void;
}

export class PluginManager {
  private context: PluginContext;
  private plugins: Map<string, RawformPlugin> = new Map();

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Registers and enables a new plugin.
   */
  public registerPlugin(plugin: RawformPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin ${plugin.id} is already registered.`);
      return;
    }
    this.plugins.set(plugin.id, plugin);
    plugin.onEnable(this.context);
    console.log(`[PluginManager] Enabled plugin: ${plugin.name} v${plugin.version}`);
  }

  /**
   * Disables and removes a plugin.
   */
  public unregisterPlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.onDisable();
      this.plugins.delete(pluginId);
      console.log(`[PluginManager] Disabled plugin: ${plugin.name}`);
    }
  }

  /**
   * Disables all active plugins.
   */
  public dispose(): void {
    for (const plugin of this.plugins.values()) {
      plugin.onDisable();
    }
    this.plugins.clear();
  }
}
