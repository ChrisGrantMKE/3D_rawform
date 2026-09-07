/**
 * Represents a single drawing layer within a spatial canvas.
 */
export interface LayerData {
  id: string;
  name: string;
  opacity: number;
  isVisible: boolean;
  isLocked: boolean;
  strokeIds: string[];
}
