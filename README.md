# Manim Quick Slice Review for VS Code

A Visual Studio Code extension that allows you to quickly preview a specific "slice" or `play()` call of your Manim animation without rendering the entire scene.

![Demo](https://i.imgur.com/your-demo-gif.gif) <!-- Placeholder for a demo GIF -->

## Features

-   **Live Slice Preview**: Press `Ctrl+Shift+1` to render and view the animation up to the line your cursor is on.
-   **Side Panel Display**: The rendered video and Manim's log output are conveniently displayed in a dedicated side panel.
-   **Intelligent Code Transformation**: The extension intelligently analyzes your code. It removes animations before the target line and converts them into instant state changes, ensuring the preview is an accurate representation of the scene at that specific moment.
-   **Fast Rendering**: By only rendering a single `play()` call, you get near-instant feedback on your changes.

## How it Works

When you trigger the preview:
1.  The extension takes your current Python script and the position of your cursor.
2.  It sends this code to a background Python script.
3.  This script uses Abstract Syntax Trees (AST) to parse your Manim scene.
    -   It removes all lines of code that come after your cursor.
    -   For lines *before* your cursor, it replaces animation calls (like `self.play(Create(X))`) with their final state equivalents (`self.add(X)`). `wait()` calls are removed.
    -   This effectively creates a temporary, "snapshot" script that sets up the scene exactly as it should be just before your target animation, and then runs only that single target animation.
4.  The extension calls `manim` to render this temporary script with low quality settings for speed.
5.  The resulting video and logs are displayed in the Manim Review side panel.

## Requirements

-   **Manim**: You must have a working installation of Manim CE (Community Edition). Make sure the `manim` command is available in your system's PATH. You can check this by running `manim --version` in your terminal.
-   **Python**: A Python interpreter is required to run the code transformation script.

## Installation

1.  Open Visual Studio Code.
2.  Go to the Extensions view (`Ctrl+Shift+X`).
3.  Search for "Manim Quick Slice Review".
4.  Click "Install".

Alternatively, you can manually install it by cloning this repository and copying it to your extensions folder.

## Usage

1.  Open a Python file containing a Manim scene.
2.  Place your cursor on a line that contains a `self.play(...)` or `self.wait(...)` call.
3.  Press `Ctrl+Shift+1` (or `Cmd+Shift+1` on macOS).
4.  The "Manim Review" side panel will open (if it's not already) and display the rendered animation and logs.

## Known Issues and Limitations

-   The AST transformation is based on common Manim patterns. Very complex or unconventional code might not be transformed correctly. For example, animations defined inside helper functions or loops might not be handled perfectly.
-   The preview quality is intentionally kept low (`-pql`) to ensure fast rendering.
-   A new temporary directory is created for each preview. These are stored in your system's temporary folder and should be cleaned up automatically by the OS, but they can accumulate.

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/your-username/manim-quick-slice-review/issues).

---

**Enjoy faster Manim prototyping!**
