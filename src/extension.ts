import * as vscode from 'vscode';
// Import OpenAI sdk
import { Configuration, OpenAIApi, ChatCompletionRequestMessageRoleEnum } from 'openai';
import{ simpleGit } from 'simple-git';
const OPEN_API_KEY = "helper.openaiKey";
import promptTexts from './prompts';
let openAiInstance: OpenAIApi | null = null;
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
    } catch(error: any) {
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
        return ;
    }
    const selection = editor.selection;
    const selectedCode = editor.document.getText(selection);
    vscode.window.showInformationMessage(`We select these code to generate the comment, please wait in mins.`);
    const prompt = `${promptTexts.commentIntroducePrompt}${selectedCode}`;
    const result = await askOpenAI(prompt, apiKey);
    if (!result) return ;
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
        return ;
    }
    const selection = editor.selection;
    const selectComment = editor.document.getText(selection);
    vscode.window.showInformationMessage(`We select the comment to polish, wait for a while please.`);
    const prompt = `${promptTexts.polishCommentIntroducePrompt}${selectComment}`;
    const result = await askOpenAI(prompt, apiKey);
    if (!result) return ;
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

export function activate(context: vscode.ExtensionContext) {
    // Subscribe all the commands when activate the plugin
	context.subscriptions.push(clearOpenAIKeyInSessionCommand);
    context.subscriptions.push(generateCommitMessageCommand);
    context.subscriptions.push(generateCommentCommand);
    context.subscriptions.push(polishCommentCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
