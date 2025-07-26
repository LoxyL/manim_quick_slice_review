import * as vscode from 'vscode';
import * as fs from 'fs';

export class SlicePreviewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'manimSliceReviewView';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.file('/')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    public updatePreview(videoUri: vscode.Uri) {
        if (this._view) {
            const webviewVideoUri = this._view.webview.asWebviewUri(videoUri);
            this._view.webview.postMessage({ type: 'updateVideo', uri: webviewVideoUri.toString() });
            this._view.webview.postMessage({ type: 'clearLog' });
        }
    }

    public updateLog(logMessage: string) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'addLog', message: logMessage });
        }
    }

    public showLoading() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'showLoading' });
        }
    }


    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Manim Slice Preview</title>
                <style>
                    body {
                        font-family: sans-serif;
                    }
                    #video-container {
                        margin-bottom: 1em;
                    }
                    video {
                        width: 100%;
                    }
                    #log-container {
                        font-family: monospace;
                        white-space: pre-wrap;
                        background-color: #1e1e1e;
                        color: #d4d4d4;
                        padding: 1em;
                        border-radius: 5px;
                        height: 300px;
                        overflow-y: scroll;
                    }
                </style>
            </head>
            <body>
                <h1>Manim Slice Preview</h1>
                <div id="video-container">
                    <p id="loading">Rendering...</p>
                    <video id="preview-video" controls autoplay muted loop style="display: none;"></video>
                </div>
                <h2>Log</h2>
                <div id="log-container"></div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const video = document.getElementById('preview-video');
                    const logContainer = document.getElementById('log-container');
                    const loadingText = document.getElementById('loading');

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'updateVideo':
                                video.src = message.uri;
                                video.style.display = 'block';
                                loadingText.style.display = 'none';
                                video.load();
                                video.play();
                                break;
                            case 'addLog':
                                logContainer.textContent += message.message;
                                logContainer.scrollTop = logContainer.scrollHeight;
                                break;
                            case 'clearLog':
                                logContainer.textContent = '';
                                break;
                            case 'showLoading':
                                video.style.display = 'none';
                                loadingText.style.display = 'block';
                                logContainer.textContent = '';
                                break;
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
} 