/**
 * Blender Integration Tools for 3D_rawform.
 * Provides a Python add-on script that users can install in Blender
 * to properly import and organize .glb files exported from 3D_rawform.
 */

const BLENDER_ADDON_SCRIPT = `
bl_info = {
    "name": "Import 3D_rawform Sketch",
    "blender": (3, 6, 0),
    "category": "Import-Export",
    "description": "Imports 3D_rawform .glb files and organizes them into native Blender collections with proper materials.",
}

import bpy

class ImportRawform(bpy.types.Operator):
    """Import a 3D_rawform GLB file"""
    bl_idname = "import_scene.rawform_glb"
    bl_label = "Import 3D_rawform (.glb)"
    bl_options = {'REGISTER', 'UNDO'}
    
    filepath: bpy.props.StringProperty(subtype="FILE_PATH")
    
    def execute(self, context):
        bpy.ops.import_scene.gltf(filepath=self.filepath)
        
        # Organize imported objects
        rawform_col = bpy.data.collections.new("3D_rawform_Sketch")
        bpy.context.scene.collection.children.link(rawform_col)
        
        for obj in bpy.context.selected_objects:
            # Move to new collection
            for col in obj.users_collection:
                col.objects.unlink(obj)
            rawform_col.objects.link(obj)
            
            # Adjust materials for viewport (enable Alpha Blend)
            if obj.type == 'MESH':
                for slot in obj.material_slots:
                    if slot.material:
                        slot.material.blend_method = 'BLEND'
                        slot.material.shadow_method = 'NONE'
                        slot.material.use_backface_culling = False
                        
        self.report({'INFO'}, "Successfully imported and organized 3D_rawform sketch.")
        return {'FINISHED'}

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}

def menu_func_import(self, context):
    self.layout.operator(ImportRawform.bl_idname, text="3D_rawform Sketch (.glb)")

def register():
    bpy.utils.register_class(ImportRawform)
    bpy.types.TOPBAR_MT_file_import.append(menu_func_import)

def unregister():
    bpy.utils.unregister_class(ImportRawform)
    bpy.types.TOPBAR_MT_file_import.remove(menu_func_import)

if __name__ == "__main__":
    register()
`;

export class BlenderIntegration {
  /**
   * Triggers download of the Blender add-on Python script.
   */
  public static downloadAddon(): void {
    const blob = new Blob([BLENDER_ADDON_SCRIPT], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'rawform_blender_importer.py';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
