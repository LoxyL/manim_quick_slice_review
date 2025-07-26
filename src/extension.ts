import * as vscode from 'vscode';
import { SlicePreviewProvider } from './webview/SlicePreviewProvider';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {

    const previewProvider = new SlicePreviewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SlicePreviewProvider.viewType, previewProvider)
    );

    let disposable = vscode.commands.registerCommand('manim-quick-slice-review.previewSlice', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'python') {
            vscode.window.showErrorMessage('This command is only available for Python files.');
            return;
        }

        const cursorPosition = editor.selection.active;
        const code = document.getText();
        const lineNumber = cursorPosition.line + 1;

        previewProvider.showLoading();

        // Create a temporary directory for the rendering process
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manim-preview-'));
        const tempScriptPath = path.join(tempDir, 'temp_scene.py');
        const transformerScriptPath = context.asAbsolutePath(path.join('python', 'transformer.py'));

        const pythonProcess = spawn('python', [transformerScriptPath, tempScriptPath, `${lineNumber}`]);
        
        pythonProcess.stdin.write(code);
        pythonProcess.stdin.end();

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code: number | null) => {
            if (code === 0) {
                const manimProcess = spawn('manim', ['-pql', tempScriptPath], { cwd: tempDir });
                
                let manimStdout = '';
                let manimStderr = '';

                manimProcess.stdout.on('data', (data: Buffer) => {
                    manimStdout += data.toString();
                    previewProvider.updateLog(data.toString());
                });

                manimProcess.stderr.on('data', (data: Buffer) => {
                    manimStderr += data.toString();
                    previewProvider.updateLog(data.toString());
                });

                manimProcess.on('close', (manimCode: number | null) => {
                    if (manimCode === 0) {
                        const files = fs.readdirSync(path.join(tempDir, 'media', 'videos', 'temp_scene', '480p15'));
                        const videoFile = files.find(f => f.endsWith('.mp4'));
                        if (videoFile) {
                            const videoPath = path.join(tempDir, 'media', 'videos', 'temp_scene', '480p15', videoFile);
                            previewProvider.updatePreview(vscode.Uri.file(videoPath));
                        }
                    } else {
                        vscode.window.showErrorMessage('Manim rendering failed.');
                        previewProvider.updateLog(manimStderr);
                    }
                });

            } else {
                vscode.window.showErrorMessage('Python script transformation failed.');
                previewProvider.updateLog(stderr);
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {} 