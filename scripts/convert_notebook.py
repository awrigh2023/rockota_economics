import json
import os

def convert_notebook_to_markdown(notebook_path, output_path):
    with open(notebook_path, 'r', encoding='utf-8') as f:
        notebook = json.load(f)
    
    markdown_content = ""
    
    for cell in notebook['cells']:
        cell_type = cell.get('cell_type', '')
        source = cell.get('source', [])
        
        if isinstance(source, list):
            source = "".join(source)
            
        if cell_type == 'markdown':
            markdown_content += source + "\n\n"
        elif cell_type == 'code':
            markdown_content += "```python\n" + source + "\n```\n\n"
            
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(markdown_content)

if __name__ == "__main__":
    notebook_path = '/Users/andy/rockota_economics/public/learning_journey/notes.ipynb'
    output_path = '/Users/andy/rockota_economics/public/learning_journey/machine_learning_notes.md'
    convert_notebook_to_markdown(notebook_path, output_path)
    print(f"Converted {notebook_path} to {output_path}")
