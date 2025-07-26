import ast
import sys
import os

class ManimASTTransformer(ast.NodeTransformer):
    def __init__(self, target_line):
        self.target_line = target_line
        self.past_target = False

    def visit(self, node):
        # Once we are past the target line, we don't visit any more nodes.
        if self.past_target or (hasattr(node, 'lineno') and node.lineno > self.target_line):
            self.past_target = True
            return None
        return super().visit(node)

    def visit_Call(self, node):
        # We are only interested in calls to self.play or self.wait
        if not (isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) and node.func.value.id == 'self'):
            return self.generic_visit(node)

        if node.func.attr in ('play', 'wait'):
             # If this is not the target line, we transform the animations to instant actions
            if node.lineno < self.target_line:
                if node.func.attr == 'wait':
                    return None # Remove waits before the target line
                
                new_nodes = []
                for arg in node.args:
                    if isinstance(arg, ast.Call):
                        # Handle Create, FadeIn -> add
                        if isinstance(arg.func, ast.Name) and arg.func.id in ('Create', 'FadeIn', 'ShowCreation'):
                            new_nodes.append(ast.Expr(value=ast.Call(
                                func=ast.Attribute(value=ast.Name(id='self', ctx=ast.Load()), attr='add', ctx=ast.Load()),
                                args=arg.args,
                                keywords=[]
                            )))
                        # Handle FadeOut, Uncreate -> remove
                        elif isinstance(arg.func, ast.Name) and arg.func.id in ('FadeOut', 'Uncreate'):
                            new_nodes.append(ast.Expr(value=ast.Call(
                                func=ast.Attribute(value=ast.Name(id='self', ctx=ast.Load()), attr='remove', ctx=ast.Load()),
                                args=arg.args,
                                keywords=[]
                            )))
                        # Handle .animate calls
                        elif isinstance(arg.func, ast.Attribute) and arg.func.attr == 'animate':
                            # This is something like `self.play(mob.animate.shift(LEFT))`
                            # We want to transform it to `mob.shift(LEFT)`
                            if isinstance(arg, ast.Call) and isinstance(arg.func.value, ast.Attribute):
                                # arg.func.value is the .animate attribute
                                # arg.func.value.value is the mobject itself (e.g., mob)
                                # arg.args are the arguments to the animation method (e.g., shift(LEFT))
                                # We need to reconstruct the call without .animate
                                animation_method_call = arg
                                original_object = animation_method_call.func.value.value
                                
                                new_call = ast.Call(
                                    func=ast.Attribute(
                                        value=original_object,
                                        attr=animation_method_call.func.attr, # e.g., 'shift'
                                        ctx=ast.Load()
                                    ),
                                    args=animation_method_call.args,
                                    keywords=animation_method_call.keywords
                                )
                                new_nodes.append(ast.Expr(value=new_call))

                if new_nodes:
                    return new_nodes if len(new_nodes) > 1 else new_nodes[0]
                
                # If we couldn't transform it, just remove the play call
                return None

        # Keep the target line's play/wait call as is
        return self.generic_visit(node)


def main():
    if len(sys.argv) != 3:
        print("Usage: python transformer.py <output_path> <line_number>")
        sys.exit(1)

    output_path = sys.argv[1]
    target_line = int(sys.argv[2])
    
    source_code = sys.stdin.read()

    try:
        tree = ast.parse(source_code)
        transformer = ManimASTTransformer(target_line)
        new_tree = transformer.visit(tree)
        ast.fix_missing_locations(new_tree)
        
        # We need to find the class name to use in the output file
        class_name = None
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                # Heuristically find the main scene class
                if any(base.id == 'Scene' for base in node.bases if isinstance(base, ast.Name)):
                    class_name = node.name
                    break
        
        if not class_name:
            # Fallback if no Scene class is found
            class_name = "TempScene"

        # The extension invokes manim with `manim -pql temp_scene.py`
        # so the class name in the script must be TempScene
        for node in ast.walk(new_tree):
            if isinstance(node, ast.ClassDef) and node.name == class_name:
                node.name = "TempScene"
                break


        modified_code = ast.unparse(new_tree)
        
        with open(output_path, 'w') as f:
            f.write(modified_code)

    except Exception as e:
        print(f"Error transforming code: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 