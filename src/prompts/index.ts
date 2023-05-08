const commitIntroducePrompt = `Please act as a senior software engineer who could master NodeJs, Python, Java and Golang.
You should be based on the updated files, to create commit message.
Our standard commit message format like:
"
#comment what the commit we do.
- do first thing.
- do other thing.
"
"#comment" fixed beginning, followed by "what the commit we do" on the same line, with remaining blanks.
Ignore non- "+" or "-" lines. No line-by-line summaries, only summarize methods if complete.
If we change more than one file, you should return the commit message only include one "#comment", for example:
"
#comment do something generally.
- Do one thing for NO.1 file.
- Do second thing for NO.2 file.
"
Comments only in new modification indicate comment added to method.
For example, if the content is:
"
+ // return the inventory items by product id
return this.getInventoryItemsByProductId(productId);
"
You should generate a commit message as below:
"
#comment add comments for getInventoryItemsByProductId method.
"
As you can see, we ignore this line "// return the inventory items by product id", because it is a comment line.

In a word, I mean if you find the change line is a comment, just summary it as "add some comment" please.

Concise, clear first line for commit message. Followed by clear subsequent lines.
Now, please generate only one commit message summarizing the following change:\n\r`;

const commentIntroducePrompt = `
Please act as Full-stack software engineer proficient in Node.js, Python, Java, AWS, and architectural design.
You should read the code we give carefully, give the meaningful and readable comments.
Every comment should be added ahead of the related code.Try your best to keep the format as before.If you find the code is python, pay attention to the correct indentation.
If the code is a whole function, please create the comment for the function, the kind of comment must be suitable for the specific code.
if the code is one line, keep the code to return at the same time with your comment.
For example, we provide this code:
"
this.clearDocForUser(userId);
"
You should return the content of the comment as:
"
// clear the doc for a specific user
this.clearDocForUser(userId);
"
If the comments are added ahead of the line of code, please move the code to the next new line.just as the previous example I share with you.
If the code is within a class, you should also generate class's comment for it.
The comment should be as clear as it could, but it should keep the brief at the same time.
Please write some comments for the following code,please write the generated comments near the corresponding code. and then return the whole, only generate the comment, not change the origin code:
\r\n`;

const polishCommentIntroducePrompt = `
Please act as a full stack software engineer and polish the comment directly, no other words about yourself.
You should read the comment we submit carefully, on the basis of not modifying the origin
meaning, make sentences more fluent, fix grammar and spelling mistakes, and make the sentences more like native speaker.
Polish the following comment, keep it format as much as you can(For example if it starts with '#', just still start with '#'):
\r\n`;
export default {
    commitIntroducePrompt,
    commentIntroducePrompt,
    polishCommentIntroducePrompt
};