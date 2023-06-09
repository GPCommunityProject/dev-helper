import * as vscode from 'vscode';
// Import OpenAI sdk
import { Configuration, OpenAIApi, ChatCompletionRequestMessageRoleEnum } from 'openai';
import{ simpleGit } from 'simple-git';
const OPEN_API_KEY = "helper.openaiKey";
import promptTexts from './prompts';
let openAiInstance: OpenAIApi | null = null;
import { exec } from 'child_process';

/**
 * Function to retrieve the OpenAI API key from the VSCode session
 * @returns {string|undefined} - The OpenAI API key
 */
const getOpenAIKeyFromSession = (): string|undefined => vscode.workspace.getConfiguration().get(OPEN_API_KEY);

/**
 * Function to store the OpenAI API key into the
 *  VSCode session
 * @param {string} apiKey - The OpenAI API key
 * @returns {Thenable<void>}
 */
const setOpenAIKeyInSession = (apiKey: string): Thenable<void> => {
    return vscode.workspace.getConfiguration().update(OPEN_API_KEY, apiKey, vscode.ConfigurationTarget.Global);
};

/**
 * Function to generate the commit message based on code, we use GPT-3.5 API to create it
 * @param apiKey - The OpenAI API key
 * @throws {Error}
 * @returns {Promise<string|undefined>} - generated commit message
 */
const generateCommitMessage = async (apiKey: string):Promise<string|undefined> => {
    try {
        const projectRootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (projectRootPath === undefined) {
            throw Error('work space is not existed');
        }
        // Run git diff to  get the change from the work space
        const myGit = simpleGit(`${projectRootPath}`);
        const changes = await myGit.diff();
        const codeChanges = changes.trim();
        const prompt = `${promptTexts.commitIntroducePrompt}${codeChanges}`;
        let result = await askOpenAI(prompt, apiKey);
        const currentBranchName = await myGit.branch();
        const pureBranchName = currentBranchName?.current
            .match(/\/([A-Z]+-\d+)/)?.[1] ?? '';
        if (result) {
            result = pureBranchName + ' ' + result;
        }
        return result;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

const generateSummaryCommitMessage = async (apiKey: string, commitMessagesToSummary: Array<string|any>)
: Promise<string|undefined> => {

    try {
        let prompt = `Please summary these commit message delimited by triple backticks into a summary commit message.
    The format should be:
    "
    #comment Add some thing in general.
    - do one thing.
    - do other thing.
    "
    `;
        const commitsToSummary = commitMessagesToSummary.join('\n');
        prompt += 'Commits: ``` ' + commitsToSummary + '```';
        let result = await askOpenAI(prompt, apiKey);
        return result;
    } catch (error) {
        console.log(error);
        throw error;
    }

};

/**
 * The command to clear the open key in session
 */
const clearOpenAIKeyInSessionCommand = 
    vscode.commands.registerCommand('dev-helper.clearOpenAIKeySession', () => {
        try {
            vscode.workspace.getConfiguration().update(
                OPEN_API_KEY,
                undefined,
                vscode.ConfigurationTarget.Global
            );
            // Notice user that open ai key has been cleared.
            vscode.window.showInformationMessage("Open AI key has been cleared!");
        } catch (error) {
            console.log(error);
            throw error;
        }
    });
/**
 * Destroy the open AiInstance in case.
 * The instance is globally, should destroy it when re-enter the openAI key
 */
const destroyOpenAiInstance = (): void => {
    openAiInstance = null;
};

/**
 * Get openAI key
 * @returns  {Promise<string>} - the string of the openAI key 
 */
const getOpenAIKey = async (): Promise<string> => {
    // Try to get the openAI key from vscode's session firstly.
    let apiKey = getOpenAIKeyFromSession();
    if (!apiKey) {
        // Prompt the user to enter the OpenAI API key if not saved in session
        const enteredApiKey = await vscode.window.showInputBox({
            prompt: 'Enter your OpenAI API key please',
            password: true
        });

        if (!enteredApiKey) {
            vscode.window.showErrorMessage('OpenAI API key is required!');
            return '';
        }

        setOpenAIKeyInSession(enteredApiKey);
        apiKey = enteredApiKey;
        // Destroy the old openAI instance for some reason.
        destroyOpenAiInstance();
    }
    return apiKey;
};
/**
 * The command to generate the commit message automatically
 */    
const generateCommitMessageCommand = vscode.commands.registerCommand(
    'dev-helper.generateCommitMessage',
    async () => {
        try {
            const apiKey = await getOpenAIKey();
            if (!apiKey) return;
            const commitMessage = await generateCommitMessage(apiKey);
            if (!commitMessage) return;
            // Display the commit message in a new edit window
            const edit = await vscode.workspace.openTextDocument({ content: commitMessage });
            await vscode.window.showTextDocument(edit, vscode.ViewColumn.Active);
        } catch (error) {
            console.log(error);
            vscode.window.showErrorMessage("Failed to generate the commit message by this plugin for some reason!");
        }
});

/**
 * Ask openAi the question that we provide
 * 
 * @param {string} queryText - the prompt for openAI
 * @param {string} apiKey - the api key for openAI
 * @returns {Promise<string|undefined>} the response from openAI
 */
const askOpenAI = async (queryText: string, apiKey: string): Promise<string|undefined> => {
    if (openAiInstance === null) {
        const configuration = new Configuration({
            apiKey,
        });
        openAiInstance = new OpenAIApi(configuration);
    }
    const message = [{
        role: ChatCompletionRequestMessageRoleEnum.User,
        content: queryText
    }];
    const modelName = 'gpt-3.5-turbo';
    try {
        const response = await openAiInstance.createChatCompletion({
            model: modelName,
            messages: message,
        });
        return response?.data?.choices?.[0]?.message?.content;
    } catch (error: any) {
        console.log(error);
        if (error.message === 'Request failed with status code 401') {
            vscode.window.showErrorMessage(`Failed to auth with openAI,
            please use dev-helper.clearOpenAIKeySession command to clear the wrong api key`);
        }
    }
};

/**
 * The command to generate comment by the selected code
 */  
const generateCommentCommand = vscode.commands.registerCommand('dev-helper.generateComment', async () => {
    try {
        const apiKey = await getOpenAIKey();
        if (!apiKey) return;
        // Write the generate comment back to the selected code
        await generateComment(apiKey);
    } catch (error) {
        console.log(error);
        throw error;
    }
});

/**
 * The function to generate the comment for the selected codes
 * @param {string} apiKey the api key for openAI
 * @returns {Promise<void>}
 */
const generateComment = async (apiKey: string): Promise<void> => {
    // Get the code which we pick from the edit window
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active edit window!');
        return;
    }
    const selection = editor.selection;
    const selectedCode = editor.document.getText(selection);
    vscode.window.showInformationMessage(`We select these code to generate the comment, please wait in mins.`);
    const prompt = `${promptTexts.commentIntroducePrompt}${selectedCode}`;
    const result = await askOpenAI(prompt, apiKey);
    if (!result) return;
    editor.edit(editBuilder => {
        editBuilder.replace(selection, result);
    });
};

/**
 * Polish the existing comment which is selected in the editor window
 * @param {string} apiKey the api key for openAI
 * @returns {Promise<void>}
 */
const polishComment = async (apiKey: string): Promise<void> => {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active edit window!');
        return;
    }
    const selection = editor.selection;
    const selectComment = editor.document.getText(selection);
    vscode.window.showInformationMessage(`We select the comment to polish, wait for a while please.`);
    const prompt = `${promptTexts.polishCommentIntroducePrompt}${selectComment}`;
    const result = await askOpenAI(prompt, apiKey);
    if (!result) return;
    editor.edit(editBuilder => {
        editBuilder.replace(selection, result);
    });
};

/**
 * The command to polish the existing comment
 */  
const polishCommentCommand = vscode.commands.registerCommand('dev-helper.polishComment', async () => {
    try {
        const apiKey = await getOpenAIKey();
        if (!apiKey) return;
        // polish the selected comment to be better
        await polishComment(apiKey);
    } catch (error) {
        console.log(error);
        throw error;
    }
});
const getProjectRootPath = () => {
    const projectRootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (projectRootPath === undefined) {
        throw Error('work space is not existed');
    }
    return projectRootPath;
};

function getWebviewContent(commits: any[]): string {
    // Make a commit list as html format
    let content = `
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">
<div class="container"><h1>Git logs for the latest 50 records</h1><ul>`;
    for (const commit of commits) {
        content += `
    <div class="row"><li class="mr-5">
        ${commit.shortHash} &nbsp; &nbsp; | &nbsp; &nbsp;  ${commit.shortMessage} &nbsp; &nbsp; | &nbsp; &nbsp;  ${commit.author}
        <button onclick="selectCommit('${commit.hash}')" id="set_${commit.hash}" class="btn btn-success">Select</button>
        <button onclick="unCheckCommit('${commit.hash}')" id="unset_${commit.hash}"style="display:none;" class="btn btn-danger">Uncheck</button>
        <button onclick="showDetail('${commit.hash}')" id="show_${commit.hash}" class="btn btn-info">View</button>
    </li>
    </div>
    `;
    }
    content += '</ul></div>';
    content += `<script>
const vscode = acquireVsCodeApi();
// Use Set to let each element is unique, define the variable to store all the selected commit hash.
const selectedCommitSet = new Set();

function unCheckCommit(commitHash) {
    // not highlight the selected commit
    const commitElement = document.querySelector(\`[onclick="unCheckCommit('\${commitHash}')"]\`).parentElement;
    commitElement.style.backgroundColor = 'white';
    selectedCommitSet.delete(commitHash);
    document.querySelector(\`button[onclick="unCheckCommit('\${commitHash}')"]\`).style.display = 'none';
    const setIdString = '#set_' + commitHash;
    document.querySelector(\`\${setIdString}\`).style.display = 'inline';
}

function showDetail(commitHash) {
    const message = {
        type: 'showDetail', commit: commitHash
    };
    vscode.postMessage(message);
}

function selectCommit(commitHash) {
    // Don't accept more than 2 commits
    if (selectedCommitSet.size >= 2) {
    return;
    }

    // highlight the selected commit
    const commitElement = document.querySelector(\`[onclick="selectCommit('\${commitHash}')"]\`).parentElement;
    // Use id to pick up the element
    const unsetIdString = '#unset_' + commitHash;
    document.querySelector(\`\${unsetIdString}\`).style.display = 'inline';
    document.querySelector(\`button[onclick="selectCommit('\${commitHash}')"]\`).style.display = 'none';
    commitElement.style.backgroundColor = 'red';
    selectedCommitSet.add(commitHash);
    // If there are two selected commits, send back to vscode to do further stuff.
    if (selectedCommitSet.size === 2) {
    const message = { type: 'selectedCommits', commits: [...selectedCommitSet] };
    // Send data to vscode, onDidReceiveMessage method will handle it directly.
    vscode.postMessage(message);
    }
}
</script>
<style>
.mr-5 {
margin: 5px;
}
</style>
`;

    return content;
}

const showGitLogInWebView =  async ():Promise<void> => {
    const projectRootPath = getProjectRootPath();
    const myGit = simpleGit(`${projectRootPath}`);
    // Maybe get 50 commits is enough
    let originCommitLog = await myGit.log(['--pretty=format:%H----%h----%an----%s', '-50']);
    const commitLogs = originCommitLog?.latest?.hash.split('\n') ?? [];
    let branches = await myGit.branch();
    let currentBranchName = branches?.current;
    // Show git logs in a webview panel
    const panel = vscode.window.createWebviewPanel(
        'gitLog',
        'show git Logs',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );
    const commits = commitLogs.map((commit) => {
        const [hash, shortHash, author, message] = commit.split('----');
        const shortMessage = message.length > 100 ? message.substring(0, 100) + "..." : message;
        if (author !== undefined) {
            return {
                hash,
                shortHash,
                message,
                author,
                shortMessage,
            };
        }
    }).filter(item => item !== undefined);
    panel.webview.html = getWebviewContent(commits);
    // TODO implement the function to pick up commit hashes to rebase
    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.type === 'selectedCommits') {
            let endCommitHash = message.commits[0];
            let startCommitHash = message.commits[1];
            let firstCommitIndex = 0;
            let secondCommitIndex = 0;
            for (let i = 0; i < commits.length; i++) {
            if (commits[i]?.hash === endCommitHash) {
                firstCommitIndex = i;
            } else if (commits[i]?.hash === startCommitHash) {
                secondCommitIndex = i;
            }
            }
            if (firstCommitIndex > secondCommitIndex) {
            const tempHash = endCommitHash;
            endCommitHash = startCommitHash;
            startCommitHash = tempHash;
            }
            // get all commit message from endCommitHash to startCommitHash
            let commitMessagesToSummary = [];
            let needCollect = false;
            for (let i = 0; i < commits.length; i++) {
            if (commits[i]?.hash === endCommitHash) {
                needCollect = true;
            }
            if (needCollect) {
                commitMessagesToSummary.push(commits[i]?.message);
            }
            if (commits[i]?.hash === startCommitHash) needCollect = false;
            }
            vscode.window.showInformationMessage(`Going to generate the summary commit message, please wait in mins.`);
            // Remove the tmp branch firstly in case
            // Find the tmp branch has exist or not
            const tempBranchName = currentBranchName + '_tmp';
            const bashCode = `
    if git rev-parse --verify ${tempBranchName} >/dev/null 2>&1; then
    # If branch exists, delete it
    git branch -D ${tempBranchName}
    echo "Branch ${tempBranchName} deleted."
    else
    echo "Branch ${tempBranchName} does not exist."
    fi
    `;
            exec(`bash -c '${bashCode}'`, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            return;
            });
            const apiKey = await getOpenAIKey();
            if (!apiKey) return;
            let summaryCommitMessage = await generateSummaryCommitMessage(apiKey, commitMessagesToSummary);
            const pureBranchName = currentBranchName
                .match(/\/([A-Z]+-\d+)/)?.[1] ?? '';
            summaryCommitMessage = pureBranchName + ' ' + summaryCommitMessage;
            // execute git rebase command with selected commits
            // git rebase -i abc123^ def456 -m "Added new feature"
            // git rebase -i --root -m 1c5b2ae^..2cd0fbd --exec "sed -i '2,\$s/pick/squash/g' \$GIT_EDITOR"
            const panelForRebase = vscode.window.createWebviewPanel(
            'gitrebase',
            'Git Rebase Guide',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );
        panelForRebase.webview.html = getRebaseGuideContent(startCommitHash, endCommitHash, summaryCommitMessage, currentBranchName);
            panelForRebase.webview.onDidReceiveMessage(async (message) => {
                if (message.type === 'showChangeBetweenCommit') {
                    const { startCommitHash, endCommitHash } = message.commits;
                    const changes = await myGit.diff([`${startCommitHash}`, `${endCommitHash}`]);
                    const panelToViewChange = vscode.window.createWebviewPanel(
                        'gitDiff',
                        'Show the changes between two commits',
                        vscode.ViewColumn.One,
                        {
                            enableScripts: true
                        }
                    );
                    panelToViewChange.webview.html = getCommitDetailContent(
                        changes,
                        `The changes between ${startCommitHash} and ${endCommitHash}`);
                }
            });
        } else if (message.type === 'showDetail') {
            // Get the detail of the commit
            const detail = (await myGit.show(['--format=fuller', message.commit.toString()]));
            const panelToView = vscode.window.createWebviewPanel(
                'gitshow',
                'Show the commit detail',
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            );
            panelToView.webview.html = getCommitDetailContent(detail);
        }
    });
};

const getCommitDetailContent = (content: string, title: string = 'The commit detail') => {
    let lines = content.split('\n');
    // Give the added line and deleted line different color format
    lines = lines.map((line) => {
        if (line.startsWith('-')) {
            return `<span style="background-color:red;">${line}</span>`;
        } else if (line.startsWith('+')) {
            return `<span style="background-color:green;">${line}</span>`;
        } else {
            return line;
        }
    });

    return `<h1>${title}</h1><pre>` + lines.join('\n') + '</pre>';
};

const getRebaseGuideContent = (startCommit: string, endCommit: string, 
    summaryCommitMessage: string, currentBranchName: string): string => {
    // todo generate the summary commit message
    // open a new webview to show how to rebase step by step
    // git rebase -i start_commit_hash end_commit_hash
    // run 2,$s/pick/squash/g to let all commit to squash
    // use the generated commit message to be the new commit message
    // checkout the new branch
    // apply the change to previous branch
    let content = `<style> 
.command-text {
    background: #A2FDFA;
    color: black;
}
</style>
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">
<div class="container">
<h1>Git rebase guide</h2>
`;
    content += '<ul><li>Step one: run this command to rebase:</li>';
    content += `<li class="command-text">git rebase -i ${startCommit}^ ${endCommit}</li>`;
    content += `<li>Step two: you will be into a editor, please paste this command in command mode: 
<div class="command-text">
2,$s/pick/squash/g
</div>
In this way, all the commits would squash.</li>`;
    content += `<li>Step three: you will ask to edit the commit message, please use the generated commit message by AI as below:
<div class="command-text">
<pre>
${summaryCommitMessage}
</pre>
</div>
</li>`;
    content += `<li>Step four.Create a new tmp branch, use this command to do:
<div class="command-text">
git checkout -b ${currentBranchName}_tmp
</duv>
</li>`;
    content += `<li>The last step: Apply the rebase change onto the current branch, the command is:
<div class="command-text">
git checkout ${currentBranchName} && git rebase ${currentBranchName}_tmp
</div>
</li>
<li style="margin: 10px;"><button onclick="showChanges('${startCommit}', '${endCommit}')" class="btn btn-info">View Changes</button>    </li>
</div>
<script>
const vscode = acquireVsCodeApi();
function showChanges(startCommitHash, endCommitHash) {
    const message = { type: 'showChangeBetweenCommit', commits: { startCommitHash, endCommitHash }};
    // send data to display the change on the another page.
    vscode.postMessage(message);
}

</script>

`;

    return content;
};

const showGitLogCommand = vscode.commands.registerCommand('dev-helper.showGitLogToRebase', async () => {
    try {
        await showGitLogInWebView();
    } catch (error) {
        console.log(error);
        throw error;
    }
});

export function activate(context: vscode.ExtensionContext) {
    // Subscribe all the commands when activate the plugin
    context.subscriptions.push(clearOpenAIKeyInSessionCommand);
    context.subscriptions.push(generateCommitMessageCommand);
    context.subscriptions.push(generateCommentCommand);
    context.subscriptions.push(polishCommentCommand);
    context.subscriptions.push(showGitLogCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
