# Dev Helper

We implement a plugin for developer to query openAI to write commit messages/comments/rebase.

# Author
Ubuntu Tang created this project, if you're interested in it, reach out with him please.
His email is ubuntu.tang@globalpay.com.

## Features

Commands as below:
- 1. clearOpenAIKeySession
- 2. generateCommitMessage
- 3. generateComment
- 4. polishComment
- 5. showGitLogToRebase (generate a colorized diff)
## Usage
You can use menu options in the editor window to use the features easier.
## Authentication

When you first query ChatGPT, you will be prompted to enter an OpenAI API key. This is used by the extension to access the API and is only sent to OpenAI.

To find your OpenAI API key:

1. Go to https://platform.openai.com/account/api-keys. You will need to log in (or sign up) to your OpenAI account.
2. Click "Create new secret key", and copy it.
3. You should then paste it into VS Code when prompted.

### Pricing

The GPT-3.5 API is charged by OpenAI at $0.002 / 1K tokens, while the GPT-4 API comes at $0.03 / 1K tokens. This is charged directly to your OpenAI account. To use this extension, you must set up billing on your account. Find more info about pricing at https://openai.com/pricing#chat.

## Current
We only can use GPT-3.5.

## TODO
- Add more useful command.
- Support GPT-4.
- Support to import your own prompt introduce message.
- Support webviewer like new bing.