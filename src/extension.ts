import * as vscode from 'vscode';
import { SlicePreviewPanel } from './webview/SlicePreviewPanel';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(
        vscode.commands.registerCommand('manim-quick-slice-review.previewSlice', () => {
            SlicePreviewPanel.createOrShow(context.extensionUri);

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

            if (SlicePreviewPanel.currentPanel) {
                SlicePreviewPanel.currentPanel.showLoading();
            }

            // 1. 读取配置
            const config = vscode.workspace.getConfiguration('manim-quick-slice-review');
            const condaEnvName = config.get<string>('condaEnvName')?.trim();

            // Create a temporary directory for the rendering process
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manim-preview-'));
            const tempScriptPath = path.join(tempDir, 'temp_scene.py');
            const transformerScriptPath = context.asAbsolutePath(path.join('python', 'transformer.py'));
            
            // 2. 准备命令和参数
            let command: string;
            let args: string[];

            if (condaEnvName) {
                // 如果设置了 Conda 环境名，使用 conda run
                command = 'conda';
                args = ['run', '-n', condaEnvName, 'python', transformerScriptPath, tempScriptPath, `${lineNumber}`];
            } else {
                // 否则，回退到直接调用 python
                command = 'python';
                args = [transformerScriptPath, tempScriptPath, `${lineNumber}`];
            }
            
            vscode.window.showInformationMessage(`Running command: ${command} ${args.join(' ')}`); // 用于调试

            // 3. 执行命令
            const pythonProcess = spawn(command, args);

            pythonProcess.on('error', (err) => {
                console.error('Failed to start subprocess.', err);
                vscode.window.showErrorMessage(`Failed to start process with command "${command}": ${err.message}. Check if Conda/Python is in your PATH.`);
            });

            pythonProcess.stdin.write(code);
            pythonProcess.stdin.end();

            let stderr = '';
            pythonProcess.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
            
            pythonProcess.on('close', (code: number | null) => {
                if (code === 0) {
                    // 渲染 Manim 的命令也需要同样的处理
                    let manimCommand: string;
                    let manimArgs: string[];
                    const scriptFileName = path.basename(tempScriptPath);

                    if (condaEnvName) {
                        manimCommand = 'conda';
                        manimArgs = ['run', '-n', condaEnvName, 'manim', '-pql', scriptFileName];
                    } else {
                        manimCommand = 'manim';
                        manimArgs = ['-pql', scriptFileName];
                    }

                    // 注意：Manim 命令需要在临时目录中执行
                    const manimProcess = spawn(manimCommand, manimArgs, { cwd: tempDir });

                    let manimStdout = '';
                    let manimStderr = '';

                    manimProcess.stdout.on('data', (data: Buffer) => {
                        manimStdout += data.toString();
                        if (SlicePreviewPanel.currentPanel) {
                            SlicePreviewPanel.currentPanel.updateLog(data.toString());
                        }
                    });

                    manimProcess.stderr.on('data', (data: Buffer) => {
                        manimStderr += data.toString();
                        if (SlicePreviewPanel.currentPanel) {
                            SlicePreviewPanel.currentPanel.updateLog(data.toString());
                        }
                    });
                    
                    manimProcess.on('close', (manimCode: number | null) => {
                        if (manimCode === 0) {
                            try {
                                // 注意：manim 渲染的临时文件名是基于我们传入的 `temp_scene.py`
                                const videoDir = path.join(tempDir, 'media', 'videos', 'temp_scene', '480p15');
                                const files = fs.readdirSync(videoDir);
                                const videoFile = files.find(f => f.endsWith('.mp4'));
                                if (videoFile) {
                                    const videoPath = path.join(videoDir, videoFile);
                                    if (SlicePreviewPanel.currentPanel) {
                                        SlicePreviewPanel.currentPanel.updatePreview(vscode.Uri.file(videoPath));
                                    }
                                } else {
                                    vscode.window.showErrorMessage('Manim rendering finished, but no video file was found.');
                                }
                            } catch (e: any) {
                                vscode.window.showErrorMessage(`Error finding video file: ${e.message}`);
                                if (SlicePreviewPanel.currentPanel) {
                                    SlicePreviewPanel.currentPanel.updateLog(manimStderr);
                                }
                            }
                        } else {
                            vscode.window.showErrorMessage('Manim rendering failed.');
                            if (SlicePreviewPanel.currentPanel) {
                                SlicePreviewPanel.currentPanel.updateLog(manimStderr);
                            }
                        }
                    });

                } else {
                    vscode.window.showErrorMessage('Python script transformation failed.');
                    if (SlicePreviewPanel.currentPanel) {
                        SlicePreviewPanel.currentPanel.updateLog(stderr);
                    }
                }
            });
        })
    );
}

export function deactivate() {} 